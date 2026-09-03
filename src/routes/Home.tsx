import { TopRated } from '../components/TopRated'
import { MealPlan } from './MealPlan'

/** Home = this week's meal plan, with a "Top rated" recipe strip beneath it. */
export function Home() {
  return (
    <div className="rb-stack">
      <MealPlan />
      <TopRated />
    </div>
  )
}
