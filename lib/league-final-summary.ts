import type {Game} from './games';

export type LeagueFinalPlayer={user_id:string;name:string;played:number;net_chips:number};
export type LeagueScorePlayer={user_id:string;name:string;played:number;wins:number};
export type LeagueFinalEvent={title:string;starts_at:string;status:string;game:Game};
export type LeagueFinalSummary={
 version:number;score_unit?:'brl_cents';league_name:string;started_at:string;finished_at:string;
 score_games?:{game:Game;variant:string;ranking:LeagueScorePlayer[]}[];
 members:number;events_total:number;events_finished:number;events_cancelled:number;
 events:LeagueFinalEvent[];
 games:Record<'poker'|'blackjack',{events:number;ranking:LeagueFinalPlayer[]}>;
};
