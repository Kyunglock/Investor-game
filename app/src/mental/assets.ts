import arenaMaps from './assets/arena-maps.png'
import blossomBun from './assets/blossomBun.webp'
import heroPoses from './assets/cat-hero-poses.png'
import lilacPoses from './assets/cat-lilac-poses.png'
import mintPoses from './assets/cat-mint-poses.png'
import nightPoses from './assets/cat-night-poses.png'
import skyPoses from './assets/cat-sky-poses.png'
import snowPoses from './assets/cat-snow-poses.png'
import sunsetPoses from './assets/cat-sunset-poses.png'
import coinCrab from './assets/coin-crab.webp'
import enemies from './assets/enemies.png'
import greenhouseHarbor from './assets/greenhouse-harbor.webp'
import hero from './assets/hero-unarmed.png'
import honeyBear from './assets/honeyBear.webp'
import iceChick from './assets/iceChick.webp'
import marketArenas from './assets/market-arenas-open.png'
import pearlSeal from './assets/pearlSeal.webp'
import picnicArenas from './assets/picnicArenas.webp'
import shortSeller from './assets/short-seller.png'
import stageMonsters from './assets/stage-monsters.png'
import starPuff from './assets/starPuff.webp'
import street from './assets/toy-arena.png'
import wallBlocks from './assets/wall-blocks-toy.png'
import weapons from './assets/weapon-arcade-atlas.png'
import battleWeapons from './assets/weapon-battle-overhead-atlas.png'
import { ROSTER_ASSETS } from './catRosterAssets'

/** Vite가 APK와 /app/ 배포 모두에 포함하는 실제 전투 자산. */
export const STAGE_ASSETS = {
  ...ROSTER_ASSETS,
  heroPoses,
  skyPoses,
  mintPoses,
  lilacPoses,
  sunsetPoses,
  nightPoses,
  snowPoses,

  street,
  arenaMaps,
  greenhouseHarbor,
  honeyBear,
  pearlSeal,
  starPuff,
  blossomBun,
  iceChick,
  marketArenas,
  picnicArenas,
  coinCrab,
  hero,
  enemies,
  stageMonsters,
  wallBlocks,
  shortSeller,
  weapons,
  battleWeapons,
}
