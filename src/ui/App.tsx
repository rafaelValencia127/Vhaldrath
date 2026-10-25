import { useServices } from '../app/services';
import { ClassView } from './ClassView';
import { Toasts } from './components';
import { Hub } from './Hub';
import { useRoute } from './router';
import { Settings } from './Settings';

export function App() {
  const { reduceMotion } = useServices();
  const [page, a, b] = useRoute();
  return (
    <div className={reduceMotion ? 'reduce-motion' : undefined}>
      {page === 'class' && a ? <ClassView classId={a} questId={b} /> : page === 'settings' ? <Settings /> : <Hub />}
      <Toasts />
    </div>
  );
}
