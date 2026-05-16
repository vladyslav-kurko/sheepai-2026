import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { postAuthSignup } from '../api/generated/authentication/authentication';
import { ApiError } from '../api/mutator';
import { useAuth } from '../context/AuthContext';
// import { SheepLogo } from '../components/icons';
import './auth.css';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await postAuthSignup({ name, email, password });
      console.log('Signup successful:', res);
      login(name);
      navigate('/');
    } catch (err) {
      console.error('Signup error:', err);
      setError(err instanceof ApiError ? err.message : 'Registration failed. This email may already be in use.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__logo">
          {/* <SheepLogo size={44} /> */}
          <h1 className="auth-card__title">Create account</h1>
          <p className="auth-card__subtitle">Join GoOver — it's free</p>
        </div>

        {error && <p className="auth-error">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              placeholder="Ivan Horvat"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
