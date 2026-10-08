/**
 * 문의·삭제 요청을 받는 이메일. 코드에 주소를 넣지 않고 환경변수(NEXT_PUBLIC_CONTACT_EMAIL)에서 읽는다.
 * NEXT_PUBLIC_ 값은 "빌드할 때" 코드에 고정되므로 바꾸면 다시 빌드해야 한다. 값이 없으면 null이고, 화면은 연락처 줄을 숨긴다.
 * (process.env.NEXT_PUBLIC_... 를 이 이름 그대로 써야 Next가 빌드 때 값으로 바꿔 넣는다)
 */
export function getContactEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return value ? value : null;
}
