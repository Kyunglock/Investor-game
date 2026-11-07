import { Document } from '../game/Document'

/**
 * 개인정보처리방침 (decisions.md 271번, #224). 광고(구글 애드센스)를 붙이면서 무엇을 모으고 광고가 쿠키를 어떻게 쓰는지 알린다. 국내 방문자만 받는 것으로
 * 보고 동의 배너(CMP)는 붙이지 않았다.
 */
export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[640px] px-4 py-6">
      <Document title="개인정보처리방침" testId="privacy">
        <div className="grid gap-4 text-[14px] leading-relaxed">
          <p className="text-[12px] text-muted">시행일 2026년 11월 6일</p>
          <section>
            <h2 className="font-semibold">1. 모으는 것</h2>
            <ul className="mt-1 list-disc pl-5">
              <li>
                <b>익명 세션 쿠키</b>: 회원 가입이 없습니다. 브라우저마다 무작위 세션 번호를 쿠키에
                담아 회사를 이어서 하게 합니다. 마지막 접속 후 30일이 지나면 만료됩니다.
              </li>
              <li>
                <b>플레이 기록</b>: 회사 상태(자본·직원·결산)와 회사를 차리고 뽑고 회의하고 결산한
                시각을 서버에 저장합니다.
              </li>
              <li>
                <b>접속 IP</b>: 부정 이용을 막고 운영 통계를 보려고 플레이 기록과 서버 로그에 접속
                IP를 함께 남깁니다.
              </li>
            </ul>
            <p className="mt-1">이름·이메일·전화번호 같은 개인 식별 정보는 받지 않습니다.</p>
          </section>
          <section>
            <h2 className="font-semibold">2. 광고와 쿠키</h2>
            <p className="mt-1">
              이 사이트는 구글 애드센스로 광고를 보여 줄 수 있습니다. 구글 등 제3자 광고 사업자는
              쿠키와 광고 식별자를 써서 이 사이트와 다른 사이트 방문 기록을 바탕으로 광고를
              고릅니다. 맞춤 광고는{' '}
              <a
                className="underline"
                href="https://adssettings.google.com"
                target="_blank"
                rel="noreferrer"
              >
                구글 광고 설정
              </a>
              에서 끌 수 있고, 구글이 광고에 데이터를 쓰는 방법은{' '}
              <a
                className="underline"
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noreferrer"
              >
                구글 광고 정책
              </a>
              에서 볼 수 있습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold">3. 보관과 삭제</h2>
            <p className="mt-1">
              플레이 기록은 서비스를 운영하는 동안 보관합니다. 브라우저 쿠키를 지우면 그 세션의
              회사로 다시 들어올 수 없습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold">4. 문의</h2>
            <p className="mt-1">
              <a
                className="underline"
                href="https://github.com/Kyunglock/Investor-game/issues"
                target="_blank"
                rel="noreferrer"
              >
                저장소의 이슈
              </a>
              로 남겨 주세요.
            </p>
          </section>
          <a href="/" className="text-[13px] text-teal underline">
            ← 게임으로 돌아가기
          </a>
        </div>
      </Document>
    </main>
  )
}
