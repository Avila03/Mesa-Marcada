import {ALL_GAMES,type Game} from '@/lib/games';
import {GAME_IDENTITY} from '@/lib/game-identity';
import {gameName} from '@/lib/mesa-types';
import GameArtwork,{GameEmblem} from './game-artwork';
import UiIcon from './ui-icon';

export default function GameChoices({onGame,onTables}:{onGame:(game:Game)=>void;onTables:()=>void}){
 return <section className="mm-home-tables">
  <header><div><span className="mm-home-kicker">MESAS FIXAS</span><h2>Escolha seu jogo</h2></div><button type="button" className="mm-home-textlink" onClick={onTables}>Mesas e tutoriais <UiIcon name="arrow-right" size={16}/></button></header>
  <div className="mm-home-tablegrid">{ALL_GAMES.map(game=><button type="button" key={game} onClick={()=>onGame(game)} className={'mm-home-table mm-personality '+game}>
   <span className="mm-home-table-icon"><GameEmblem game={game}/></span>
   <span className="mm-home-table-description"><strong>{gameName(game)}</strong><small>{GAME_IDENTITY[game].detail}</small></span>
   <GameArtwork game={game}/><UiIcon name="arrow-right" size={18}/>
  </button>)}</div>
 </section>;
}
