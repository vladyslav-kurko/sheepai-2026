import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// import { SheepLogo } from './icons';
import './Header.css';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <Link to="/" className="header__logo">
        {/* <SheepLogo size={28} /> */}
        <span className="header__logo-text">GoOver</span>
      </Link>
      <nav className="header__nav">
        {user ? (
          <>
            <div className="header__user">
              <span className="header__avatar">{user.name[0].toUpperCase()}</span>
              <span className="header__username">{user.name}</span>
            </div>
            <button className="header__logout" onClick={logout}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/signin" className="header__signin">Sign in</Link>
            <Link to="/signup" className="header__signup">Create account</Link>
          </>
        )}
      </nav>
    </header>
  );
}
