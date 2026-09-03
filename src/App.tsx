import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './auth/RequireAuth'
import { AuthCallback } from './routes/AuthCallback'
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
