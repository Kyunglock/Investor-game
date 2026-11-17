/** 생선 (decisions.md 570번): 환생하면 얻고 고양이의 레벨을 올리는 재료. 글씨 크기를 따라간다. */
export function FishIcon() {
  return (
    <svg className="idle-fish" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path
        d="M2.5 12c2.6-4 6.2-6 10-6 3.3 0 6 1.7 8 4l2-2.5v9L20.5 14c-2 2.3-4.7 4-8 4-3.8 0-7.4-2-10-6Z"
        fill="#5cc3ee"
        stroke="#1f6f9c"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11" r="1.3" fill="#123f5c" />
      <path d="M12.5 9c1 1.8 1 4.2 0 6" fill="none" stroke="#1f6f9c" strokeWidth="1.3" />
    </svg>
  )
}
