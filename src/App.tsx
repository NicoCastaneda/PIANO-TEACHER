import { useRoute } from './lib/router'
import { Shell } from './ui/layout/Shell'
import { HomePage } from './ui/pages/HomePage'
import { TodayPage } from './ui/pages/TodayPage'
import { KeyboardPage } from './ui/pages/KeyboardPage'
import { AccompanyPage } from './ui/pages/AccompanyPage'
import { EarTrainingPage } from './ui/pages/ear/EarTrainingPage'
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
      page = param === 'oido' ? <EarTrainingPage key={route.query.get('ej') ?? ''} drill={route.query.get('ej')} /> : <PracticePage preset={param} />
      break
    case 'songs':
      page =
        param && route.segments[2] === 'acompanar' ? <AccompanyPage key={param} songId={param} /> : param ? <SongPage key={param} songId={param} sectionId={route.query.get('section')} /> : <SongsPage />
      break
    case 'hoy':
      page = <TodayPage />
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
