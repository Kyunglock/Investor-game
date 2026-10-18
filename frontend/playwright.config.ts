import { defineConfig, devices } from '@playwright/test'

const gradle = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // 모바일 우선이되 데스크톱에서는 넓게 쓴다 (decisions.md 20번). 두 화면 모두 검사한다.
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      // Testcontainers로 Postgres를 띄우므로 로컬 DB 없이 Docker만 있으면 된다.
      command: `${gradle} bootTestRun`,
      cwd: '../backend',
      url: 'http://localhost:8080/actuator/health',
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
