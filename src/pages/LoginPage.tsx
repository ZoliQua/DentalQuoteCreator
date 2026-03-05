import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import dcqLogo from '../assets/dcq_logo.svg';

export function LoginPage() {
  const { login } = useAuth();
  const { t, appLanguage, setAppLanguage } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.login.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-hover flex items-center justify-center px-4 relative">
      <div className="w-full max-w-md bg-theme-secondary rounded-2xl shadow-sm border border-theme-primary p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={dcqLogo} alt="DentalQuoter" className="w-24 h-24 mb-3" />
          <span className="text-2xl font-bold text-theme-primary">DentalQuoter</span>
        </div>
        <h1 className="text-2xl font-bold text-theme-primary">{t.login.title}</h1>
        <p className="text-theme-secondary mt-2">{t.login.subtitle}</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1" htmlFor="email">
              {t.login.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-theme-secondary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-dental-500"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1" htmlFor="password">
              {t.login.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-theme-secondary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-dental-500"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dental-600 hover:bg-dental-700 text-white font-medium rounded-lg px-4 py-2 disabled:opacity-60"
          >
            {loading ? t.login.loggingIn : t.login.loginButton}
          </button>
        </form>
      </div>

      <div className="absolute bottom-4 left-4">
        <select
          id="login-language"
          value={appLanguage}
          onChange={(event) => setAppLanguage(event.target.value as 'hu' | 'en' | 'de')}
          className="rounded-lg border border-theme-secondary bg-theme-secondary px-3 py-2 text-sm text-theme-secondary focus:outline-none focus:ring-2 focus:ring-dental-500"
        >
          <option value="hu">{t.settings.hungarian}</option>
          <option value="en">{t.settings.english}</option>
          <option value="de">{t.settings.german}</option>
        </select>
      </div>
    </div>
  );
}
