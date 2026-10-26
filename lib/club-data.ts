import type {Attendance,Event,Profile,Room,Poll,Choice,Vote,Buy,BuyItem,ChipResult,Expense,ChipCashout,ChipFinalItem,ChipPayout,TableSeat} from "./mesa-types";
import type {LiveState,LiveActivity} from "@/app/painel/event-live-panel";
import type {HiddenEvent,AdminFinance} from "@/app/painel/admin-panel";
import type {FinanceLine} from "@/app/painel/v09-features";
import type {ExpenseSplitRow,ExpenseSettlement} from "@/app/painel/expense-splits";
export type Catalog={rooms:Room[];events:Event[];profiles:Profile[];attendance:Attendance[];live:LiveState[];hidden:HiddenEvent[];admin_finance:AdminFinance[];history_more:boolean;history_cursor:{at:string;id:string}|null};
export type EventSnapshot={attendance:Attendance[];profiles:Profile[];polls:Poll[];choices:Choice[];votes:Vote[];buys:Buy[];items:BuyItem[];results:ChipResult[];expenses:Expense[];members:{expense_id:string;session_id:string;user_id:string;joined_at:string}[];settlements:ExpenseSettlement[];approvals:{session_id:string;user_id:string;reviewed_at:string}[];finals:ChipFinalItem[];cashouts:ChipCashout[];payouts:ChipPayout[];seats:TableSeat[];live:LiveState[];timeline:LiveActivity[];finance:FinanceLine[];shares:ExpenseSplitRow[]};
