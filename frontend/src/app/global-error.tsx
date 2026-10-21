"use client";

/**
 * 맨 바깥 레이아웃까지 깨졌을 때의 마지막 안전망. 이 파일은 레이아웃을 대신하므로 <html>·<body>를 직접 그린다.
 * 번역 공급자와 Tailwind 스타일이 없는 상태라서 한국어·일본어 문구를 같이 적고 스타일은 인라인으로 둔다.
 * 오류 내용은 보이지 않는다.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0f1218",
          color: "#e8ebf2",
          textAlign: "center",
          padding: 16,
        }}
      >
        <div role="alert">
          <h1 style={{ fontSize: 20 }}>문제가 생겼습니다 / 問題が発生しました</h1>
          <p style={{ fontSize: 14, opacity: 0.8 }}>
            잠시 후 다시 시도해 주세요.
            <br />
            しばらくしてからもう一度お試しください。
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 12, padding: "8px 16px", fontSize: 14, borderRadius: 6, cursor: "pointer" }}
          >
            다시 시도 / 再試行
          </button>
        </div>
      </body>
    </html>
  );
}
