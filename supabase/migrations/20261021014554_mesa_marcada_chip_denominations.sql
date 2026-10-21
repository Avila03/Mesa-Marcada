-- Mesa Marcada — compras/recompras por denominação.
-- Convenção do Bruno: ficha 1 = R$1, 5 = R$5, 10 = R$0,10,
-- 25 = R$0,25, 50 = R$0,50. O número impresso segue representando pontos.
-- Migração aditiva: mantém sessões e compras históricas intactas.

ALTER TABLE public.sessions
  ADD COLUMN chip_pricing_special boolean NOT NULL DEFAULT false,
  ADD COLUMN chip_price_1_brl numeric(10,2) NOT NULL DEFAULT 1.00
    CONSTRAINT price_1_positive CHECK (chip_price_1_brl BETWEEN 0.01 AND 1000),
  ADD COLUMN chip_price_5_brl numeric(10,2) NOT NULL DEFAULT 5.00
    CONSTRAINT price_5_positive CHECK (chip_price_5_brl BETWEEN 0.01 AND 1000),
  ADD COLUMN chip_price_10_brl numeric(10,2) NOT NULL DEFAULT 0.10
    CONSTRAINT price_10_positive CHECK (chip_price_10_brl BETWEEN 0.01 AND 1000),
  ADD COLUMN chip_price_25_brl numeric(10,2) NOT NULL DEFAULT 0.25
    CONSTRAINT price_25_positive CHECK (chip_price_25_brl BETWEEN 0.01 AND 1000),
  ADD COLUMN chip_price_50_brl numeric(10,2) NOT NULL DEFAULT 0.50
    CONSTRAINT price_50_positive CHECK (chip_price_50_brl BETWEEN 0.01 AND 1000),
  ADD COLUMN chip_pricing_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.sessions
  ADD CONSTRAINT only_special_events_use_custom_prices CHECK (
    chip_pricing_special OR (
      chip_price_1_brl=1.00 AND chip_price_5_brl=5.00
      AND chip_price_10_brl=0.10 AND chip_price_25_brl=0.25
      AND chip_price_50_brl=0.50
    )
  );

-- Se já houver alguma compra anterior, a regra também ficará bloqueada
-- na primeira tentativa de alterar os valores; não altera registros antigos.
CREATE OR REPLACE FUNCTION app_private.protect_event_chip_pricing()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  IF OLD.chip_pricing_locked AND (
    NEW.chip_pricing_locked IS DISTINCT FROM OLD.chip_pricing_locked
    OR NEW.chip_pricing_special IS DISTINCT FROM OLD.chip_pricing_special
    OR NEW.chip_price_1_brl IS DISTINCT FROM OLD.chip_price_1_brl
    OR NEW.chip_price_5_brl IS DISTINCT FROM OLD.chip_price_5_brl
    OR NEW.chip_price_10_brl IS DISTINCT FROM OLD.chip_price_10_brl
    OR NEW.chip_price_25_brl IS DISTINCT FROM OLD.chip_price_25_brl
    OR NEW.chip_price_50_brl IS DISTINCT FROM OLD.chip_price_50_brl
  ) THEN
    RAISE EXCEPTION 'Os preços das fichas estão bloqueados após a primeira compra';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.session_chip_purchases b WHERE b.session_id=OLD.id
  ) AND (
    NEW.chip_pricing_special IS DISTINCT FROM OLD.chip_pricing_special
    OR NEW.chip_price_1_brl IS DISTINCT FROM OLD.chip_price_1_brl
    OR NEW.chip_price_5_brl IS DISTINCT FROM OLD.chip_price_5_brl
    OR NEW.chip_price_10_brl IS DISTINCT FROM OLD.chip_price_10_brl
    OR NEW.chip_price_25_brl IS DISTINCT FROM OLD.chip_price_25_brl
    OR NEW.chip_price_50_brl IS DISTINCT FROM OLD.chip_price_50_brl
  ) THEN
    RAISE EXCEPTION 'Não é possível alterar os preços depois de uma compra';
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_chip_prices_before_update
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION app_private.protect_event_chip_pricing();

-- Cada compra tem cinco linhas opcionais (somente as quantidades positivas).
-- Preço unitário é o snapshot na hora do registro.
CREATE TABLE public.session_chip_purchase_items (
  purchase_id uuid NOT NULL REFERENCES public.session_chip_purchases(id) ON DELETE CASCADE,
  chip_value integer NOT NULL CHECK (chip_value IN (1,5,10,25,50)),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 2000),
  unit_price_brl numeric(10,2) NOT NULL CHECK (unit_price_brl BETWEEN 0.01 AND 1000),
  PRIMARY KEY(purchase_id,chip_value)
);
ALTER TABLE public.session_chip_purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchase_items_read_authorized ON public.session_chip_purchase_items
  FOR SELECT TO authenticated
  USING (
    EXISTS(
      SELECT 1 FROM public.session_chip_purchases p
      WHERE p.id=purchase_id AND app_private.can_view_session_private(p.session_id)
    )
  );
REVOKE ALL ON public.session_chip_purchase_items FROM public,anon;
GRANT SELECT ON public.session_chip_purchase_items TO authenticated;

-- Somente uma função transacional poderá criar compras no modelo novo.
-- Compras antigas podem ser visualizadas/excluídas por quem as criou
-- enquanto a sessão estiver agendada.
REVOKE INSERT,UPDATE ON public.session_chip_purchases FROM authenticated;

-- Reforça que não se pode adulterar um registro de compra por update.
CREATE OR REPLACE FUNCTION app_private.prevent_purchase_update()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
  RAISE EXCEPTION 'Uma compra é imutável; exclua e registre novamente antes do encerramento';
END;
$$;
CREATE TRIGGER purchase_immutable_values
BEFORE UPDATE ON public.session_chip_purchases
FOR EACH ROW EXECUTE FUNCTION app_private.prevent_purchase_update();

-- Constrói uma compra + todas as denominações numa única transação,
-- com autenticação, presença, preço e quantidade validados no servidor.
CREATE FUNCTION public.record_chip_purchase(p_event_id uuid,p_quantities jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
  v_user uuid;
  v_event public.sessions%ROWTYPE;
  v_values integer[] := ARRAY[1,5,10,25,50];
  v_prices numeric[];
  v_quantity integer;
  v_total_pieces integer := 0;
  v_total_points bigint := 0;
  v_amount numeric(12,2) := 0;
  v_purchase_id uuid;
  v_i integer;
  v_raw text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Faça login para registrar fichas';
  END IF;
  IF p_quantities IS NULL OR jsonb_typeof(p_quantities)<>'array'
    OR jsonb_array_length(p_quantities)<>5 THEN
    RAISE EXCEPTION 'Envie cinco quantidades: [1,5,10,25,50]';
  END IF;

  SELECT * INTO v_event FROM public.sessions
  WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status<>'scheduled' THEN
    RAISE EXCEPTION 'Evento não encontrado ou encerrado';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.session_attendance a
    WHERE a.session_id=p_event_id AND a.user_id=v_user
  ) THEN
    RAISE EXCEPTION 'Confirme sua presença antes de registrar fichas';
  END IF;

  v_prices:=ARRAY[v_event.chip_price_1_brl,v_event.chip_price_5_brl,
    v_event.chip_price_10_brl,v_event.chip_price_25_brl,v_event.chip_price_50_brl];

  FOR v_i IN 1..5 LOOP
    v_raw:=p_quantities->>(v_i-1);
    IF v_raw IS NULL OR v_raw !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Quantidade inválida para ficha de %',v_values[v_i];
    END IF;
    v_quantity:=v_raw::integer;
    IF v_quantity>2000 THEN
      RAISE EXCEPTION 'Máximo de 2.000 unidades por denominação';
    END IF;
    v_total_pieces:=v_total_pieces+v_quantity;
    v_total_points:=v_total_points+v_values[v_i]*v_quantity;
    v_amount:=v_amount+v_prices[v_i]*v_quantity;
  END LOOP;

  IF v_total_pieces<1 OR v_total_pieces>5000 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 5.000 fichas por compra';
  END IF;
  IF v_amount>9999999999.99 THEN
    RAISE EXCEPTION 'Valor excede limite de lançamento';
  END IF;

  -- Bloqueia definitivamente as regras antes da primeira compra.
  UPDATE public.sessions SET chip_pricing_locked=true
  WHERE id=p_event_id AND NOT chip_pricing_locked;

  INSERT INTO public.session_chip_purchases
    (session_id,user_id,chips_received,amount_brl,note)
  VALUES(p_event_id,v_user,v_total_points,v_amount,'Compra registrada por denominações')
  RETURNING id INTO v_purchase_id;

  FOR v_i IN 1..5 LOOP
    v_quantity:=(p_quantities->>(v_i-1))::integer;
    IF v_quantity>0 THEN
      INSERT INTO public.session_chip_purchase_items
        (purchase_id,chip_value,quantity,unit_price_brl)
      VALUES(v_purchase_id,v_values[v_i],v_quantity,v_prices[v_i]);
    END IF;
  END LOOP;
  RETURN v_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_chip_purchase(uuid,jsonb)
  FROM public,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_purchase(uuid,jsonb)
  TO authenticated;
REVOKE ALL ON FUNCTION app_private.protect_event_chip_pricing()
  FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION app_private.prevent_purchase_update()
  FROM public,anon,authenticated;
