import { useRoute } from './lib/router'
import { Shell } from './ui/layout/Shell'
import { HomePage } from './ui/pages/HomePage'
import { KeyboardPage } from './ui/pages/KeyboardPage'
import { ChordTrainerPage } from './ui/pages/chords/ChordTrainerPage'
import { LearnPage, LessonPage } from './ui/pages/LearnPage'
import { PracticePage } from './ui/pages/PracticePage'
import { ProgressPage } from './ui/pages/ProgressPage'
import { SettingsPage } from './ui/pages/SettingsPage'
import { SongPage, SongsPage } from './ui/pages/SongsPage'

export function App() {
  const route = useRoute()
  const [section, param] = route.segments
  let page
  switch (section) {
    case undefined:
      page = <HomePage />
      break
    case 'learn':
      page = param === 'acordes' ? <ChordTrainerPage tab={route.query.get('tab')} /> : param ? <LessonPage key={param} lessonId={param} /> : <LearnPage />
      break
    case 'practice':
      page = <PracticePage preset={param} />
      break
    case 'songs':
      page = param ? <SongPage key={param} songId={param} sectionId={route.query.get('section')} /> : <SongsPage />
      break
    case 'keyboard':
      page = <KeyboardPage />
      break
    case 'progress':
      page = <ProgressPage />
      break
    case 'settings':
      page = <SettingsPage tab={param} />
      break
    default:
      page = <HomePage />
  }
  return <Shell>{page}</Shell>
}
