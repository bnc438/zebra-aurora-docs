import React from 'react';
import {useHistory, useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './LanguageDropdown.module.css';

// List of stable locales. Add more locale codes as they are production-ready.
const stableLocales = ['en'];

export default function LanguageDropdown() {
  const {i18n} = useDocusaurusContext();
  const history = useHistory();
  const location = useLocation();
  const {locales, currentLocale} = i18n;

  const handleChange = (e) => {
    const newLocale = e.target.value;
    if (newLocale !== currentLocale) {
      // Replace the locale in the pathname
      const newPath = location.pathname.replace(
        `/${currentLocale === i18n.defaultLocale ? '' : currentLocale}`,
        newLocale === i18n.defaultLocale ? '' : `/${newLocale}`
      );
      history.push(newPath + location.search + location.hash);
    }
  };

  return (
    <select className={styles.languageDropdown} value={currentLocale} onChange={handleChange}>
      {locales.map((locale) => (
        <option
          key={locale}
          value={locale}
          disabled={!stableLocales.includes(locale)}
        >
          {locale.toUpperCase()} {stableLocales.includes(locale) ? '' : '(Coming Soon)'}
        </option>
      ))}
    </select>
  );
}
