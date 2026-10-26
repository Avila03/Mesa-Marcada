import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const expense=read("app/painel/expense-composer.tsx");
const styles=read("app/painel/expense-composer.css");
const info=panel.indexOf('<h2>Informações do evento</h2>');
const polls=panel.indexOf('<PollComposer key=');
const composer=panel.indexOf('<ExpenseComposer key=');
const list=panel.indexOf('id="event-expenses"');
assert.ok(info>=0&&polls>info&&composer>polls&&list>composer,
 "Expense creator must be beside poll creator in event information, before expense list");
assert.equal((panel.match(/<ExpenseComposer key=/g)||[]).length,1,
 "Only one expense composer may render.");
assert.ok(panel.includes('createForm={null}'),"Remove old bottom expense form");
for(const obsolete of ["showAddExpense","mm-overview-expense-tools","setExpenseName","expenseAmount","expensePayer"])
 assert.ok(!panel.includes(obsolete),"Old bottom expense input remains: "+obsolete);
for(const token of ["session_expenses","paid_by:payer",'afterSaved("expenses"',
 '<ExpenseSplitsPanel','onToggleOpen','onDelete','Ver despesas e rachas →'])
 assert.ok(panel.includes(token),"Original expense and split behavior missing: "+token);
for(const token of ["aria-expanded={open}","setOpen(v=>!v)","setOpen(false)",
 "onCreate({label:label.trim(),amount:parsed,category,paidBy:validPayer})",
 "Quem pagou?","Valor (R$)","Categoria","Salvar despesa"])
 assert.ok(expense.includes(token),"Expense composer behavior missing: "+token);
assert.ok(styles.includes("@media(max-width:560px)"),"Mobile layout missing");
console.log("✓ Despesa recolhível junto da enquete; histórico e rachas preservados.");
