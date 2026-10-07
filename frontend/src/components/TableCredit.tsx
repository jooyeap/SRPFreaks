import { TABLE_CREDIT } from "@/lib/credit";

/**
 * 서열표 정보 제공자 표기 한 줄. 외부 링크(X)는 새 탭으로 열고, 이쪽 창의 정보가 새 탭에 넘어가지 않도록 noopener를 붙인다.
 * 360px에서도 줄바꿈이 자연스럽게 되도록 한 문장으로 두고 break-words를 쓴다.
 */
export function TableCredit({ className }: { className?: string }) {
  return (
    <p className={className}>
      {TABLE_CREDIT.label}{" "}
      <a
        href={TABLE_CREDIT.url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words underline underline-offset-2 hover:text-fg"
      >
        {TABLE_CREDIT.name} ({TABLE_CREDIT.handle})
      </a>
    </p>
  );
}
