import React from 'react';
import styles from './DitaSemantic.module.css';

/**
 * Restores DITA <prereq> semantics.
 * Usage: <Prereq>Ensure the device is connected before proceeding.</Prereq>
 */
export function Prereq({ children }) {
  return (
    <div className={styles.prereq} role="note" aria-label="Prerequisites">
      <div className={styles.prereqHeader}>Prerequisites</div>
      <div className={styles.prereqBody}>{children}</div>
    </div>
  );
}

/**
 * Restores DITA <result> / <postreq> semantics.
 * Usage: <TaskResult>The device is now configured.</TaskResult>
 */
export function TaskResult({ children, type = 'result' }) {
  const label = type === 'postreq' ? 'What to do next' : 'Result';
  return (
    <div className={styles.taskResult} role="note" aria-label={label}>
      <div className={styles.taskResultHeader}>{label}</div>
      <div className={styles.taskResultBody}>{children}</div>
    </div>
  );
}

/**
 * Restores DITA <uicontrol> semantics.
 * Usage: Click <UIControl>Save</UIControl> to apply changes.
 */
export function UIControl({ children }) {
  return <span className={styles.uicontrol}>{children}</span>;
}

/**
 * Restores DITA <menucascade> semantics.
 * Usage: <MenuCascade items={['File', 'Export', 'PDF']} />
 */
export function MenuCascade({ items = [] }) {
  return (
    <span className={styles.menucascade}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={styles.menusep} aria-hidden="true"> &rsaquo; </span>}
          <span className={styles.uicontrol}>{item}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * Restores DITA keyboard/userinput semantics.
 * Usage: Press <KBD>Ctrl+S</KBD> to save.
 */
export function KBD({ children }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

/**
 * Restores DITA <context> semantics for task topics.
 * Usage: <TaskContext>This procedure configures the device network settings.</TaskContext>
 */
export function TaskContext({ children }) {
  return (
    <div className={styles.taskContext}>
      {children}
    </div>
  );
}

/**
 * Restores DITA <stepresult> semantics.
 * Usage within step lists:
 *   1. Click **Save**.
 *      <StepResult>The settings are applied.</StepResult>
 */
export function StepResult({ children }) {
  return (
    <div className={styles.stepResult} role="note" aria-label="Step result">
      <span className={styles.stepResultIcon}>→</span> {children}
    </div>
  );
}
