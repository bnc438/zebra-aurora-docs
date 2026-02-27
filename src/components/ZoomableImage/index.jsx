import React, {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import styles from './styles.module.css';

export default function ZoomableImage(props) {
  const {style, className, alt, ...rest} = props;
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('fit');

  const mergedStyle = useMemo(
    () => ({
      ...style,
      cursor: 'zoom-in',
    }),
    [style],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const overlay = isOpen ? (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={() => setIsOpen(false)}>
      <div
        className={styles.toolbar}
        onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={styles.button}
          onClick={() => setMode((current) => (current === 'fit' ? 'actual' : 'fit'))}>
          {mode === 'fit' ? 'Actual Size' : 'Fit to Screen'}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => setIsOpen(false)}>
          Close
        </button>
      </div>

      <div
        className={mode === 'fit' ? styles.fitContainer : styles.actualContainer}
        onClick={(event) => event.stopPropagation()}>
        <img
          {...rest}
          alt={alt}
          className={mode === 'fit' ? styles.fitImage : styles.actualImage}
          onClick={() => setIsOpen(false)}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <span className={styles.trigger}>
        <img
          {...rest}
          alt={alt}
          className={className}
          style={mergedStyle}
          onClick={() => setIsOpen(true)}
        />
        <span className={styles.hint} aria-hidden="true">
          Click to zoom
        </span>
      </span>
      {isOpen && typeof document !== 'undefined' ? createPortal(overlay, document.body) : null}
    </>
  );
}