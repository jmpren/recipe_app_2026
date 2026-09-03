import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './auth/RequireAuth'
import { AuthCallback } from './routes/AuthCallback'
import { CookingMode } from './routes/CookingMode'
import { Login } from './routes/Login'
import { RecipeDetail } from './routes/RecipeDetail'
import { RecipeEdit } from './routes/RecipeEdit'
import { RecipeList } from './routes/RecipeList'
import { RecipeNew } from './routes/RecipeNew'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RecipeList />} />
          <Route path="/recipes/new" element={<RecipeNew />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
        </Route>
        {/* Cooking mode is full-page: no app chrome, still auth-gated. */}
        <Route path="/recipes/:id/cook" element={<CookingMode />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
