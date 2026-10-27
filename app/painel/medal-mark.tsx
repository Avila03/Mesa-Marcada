import './medal-mark.css';
import {GameEmblem} from './game-artwork';
import UiIcon from './ui-icon';
import type {Medal} from './medal-catalog';
import type {Game} from '@/lib/games';

function Drawing({medal}:{medal:Medal}){
 const game=medal.id.split('_')[0];
 if(['truco','canastra','pontinho','uno','pife'].includes(game))return <GameEmblem game={game as Game}/>;
 if(medal.id==='draw_poker')return <GameEmblem game="poker"/>;
 if(medal.id==='explorer')return <UiIcon name="grid"/>;
 if(medal.id==='duo_wins')return <UiIcon name="users"/>;
 if(medal.id==='league_cards')return <UiIcon name="trophy"/>;
 return <>{medal.symbol}</>;
}

export default function MedalMark({medal}:{medal:Medal}){return <span className="mm-medal-mark"><Drawing medal={medal}/></span>}
