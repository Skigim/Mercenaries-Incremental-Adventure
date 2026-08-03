import { CampBoard } from './camp/CampBoard';
import { useGame } from './useGame';
import './styles.css';

export function App() {
  const game = useGame();
  return <CampBoard game={game} />;
}
