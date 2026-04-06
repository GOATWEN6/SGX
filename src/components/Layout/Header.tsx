/**
 * AI 回忆录助手 - Header 顶部导航组件
 */
import styles from './Header.module.css';

interface HeaderProps {
  onSettingsClick: () => void;
  onMemoirClick: () => void;
}

export default function Header({ onSettingsClick, onMemoirClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <span className={styles.logoIcon}>📖</span>
        <span className={styles.headerTitle}>AI 回忆录助手</span>
        <span className={styles.companionBadge}>温暖陪伴</span>
      </div>
      <div className={styles.headerRight}>
        <button
          className={styles.iconBtn}
          onClick={onMemoirClick}
          title="我的回忆录"
        >
          📚 回忆录
        </button>
        <button
          className={styles.iconBtn}
          onClick={onSettingsClick}
          title="显示设置"
        >
          ⚙️ 设置
        </button>
      </div>
    </header>
  );
}