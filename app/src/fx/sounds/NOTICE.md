# 효과음의 출처와 라이선스

이 폴더의 `.ogg` 효과음은 모두 **CC0 1.0**(저작권을 포기한 공개 저작물)이다. 상업적으로 쓸 수 있고 출처를 적지 않아도 된다. 전문은 `CC0-1.0.txt`.

- 만든 곳: Kenney (https://www.kenney.nl)의 사운드 팩 — Impact Sounds, Interface Sounds, RPG Audio, Sci-fi Sounds, Digital Audio. 각 팩의 License.txt가 "Creative Commons Zero, CC0"라고 적는다.
- 받은 곳: npm 패키지 `@netforge/asset-library-files` 0.2.0의 `library/audio/sfx/`. 그 패키지의 `NOTICE`가 위 팩과 라이선스를 적고 있다. 파일 이름은 그 패키지가 붙인 것이다(big_kill·coin·confirm …).
- (알려 둘 것) kenney.nl에서 직접 받은 것이 아니라 그 패키지가 다시 묶은 파일이다. 원본과 한 바이트도 다르지 않은지는 견주지 못했다. 직접 받은 파일로 바꾸려면 같은 이름으로 덮어쓰면 된다.

어느 소리에 쓰는지는 `../sound.ts`의 `sfx`에 있다. 파일을 풀지 못하는 브라우저에서는 전처럼 Web Audio로 만든 소리가 난다.
