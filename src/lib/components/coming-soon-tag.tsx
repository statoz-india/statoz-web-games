import styles from "./css/coming-soon-tag.module.css";

type ComingSoonTagProps = {
  className?: string;
};

/** Gold "COMING SOON" chip; the parent places it. */
export function ComingSoonTag({ className = "" }: ComingSoonTagProps) {
  return (
    <span
      className={`inline-flex flex-none items-center ${styles["coming-soon-tag"]} ${className}`}
    >
      COMING SOON
    </span>
  );
}
