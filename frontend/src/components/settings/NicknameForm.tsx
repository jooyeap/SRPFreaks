"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, nicknameSchema } from "@/lib/nickname";
import { updateMyNickname } from "@/lib/users";

// 입력은 문자열 그대로, 결과는 정규화된 값(빈 값이면 null)이다. 그래서 입력/출력 타입이 다르다.
const formSchema = z.object({ nickname: nicknameSchema });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

/** 닉네임 설정 폼. 서버와 같은 규칙으로 먼저 검사하고(lib/nickname.ts), 저장하면 헤더의 이름도 바로 바뀐다. */
export function NicknameForm({ initialNickname }: { initialNickname: string | null }) {
  const { updateUser } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { nickname: initialNickname ?? "" },
    mode: "onTouched",
  });

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => updateMyNickname(values.nickname),
    onSuccess: (user) => {
      updateUser(user);
      reset({ nickname: user.nickname ?? "" }); // 서버가 정규화한 값으로 입력칸도 맞춘다
    },
  });

  const failure = mutation.error;
  const serverMessage =
    failure instanceof ApiError ? failure.message : failure ? "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." : null;
  const nicknameError = errors.nickname?.message;

  return (
    <form
      onSubmit={handleSubmit((values) => {
        mutation.reset();
        mutation.mutate(values);
      })}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nickname" className="text-sm font-semibold text-fg">
          닉네임
        </label>
        <input
          id="nickname"
          type="text"
          autoComplete="off"
          aria-invalid={nicknameError ? true : undefined}
          aria-describedby="nickname-help nickname-error"
          className="w-full rounded-xl border border-chip-line bg-page px-3 py-2 text-base text-fg outline-none focus:border-fg-sub"
          {...register("nickname")}
        />
        <p id="nickname-help" className="text-xs text-fg-dim">
          {NICKNAME_MIN_LENGTH}~{NICKNAME_MAX_LENGTH}자. 영문, 숫자, 일본어(히라가나·가타카나·한자)와 ー ・ _ - 만 사용할 수 있습니다. 비워 두면 이메일이
          표시됩니다.
        </p>
        <p id="nickname-error" role="alert" className="min-h-4 text-xs text-danger">
          {nicknameError ?? serverMessage}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-11 rounded-xl bg-chip-on-bg px-6 text-sm font-extrabold text-chip-on-fg disabled:opacity-60"
        >
          저장
        </button>
        {mutation.isSuccess ? (
          <p role="status" className="text-sm text-fg-sub">
            저장했습니다.
          </p>
        ) : null}
      </div>
    </form>
  );
}
