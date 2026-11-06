import { Capacitor } from '@capacitor/core'

/**
 * 안드로이드 앱(Capacitor WebView) 안에서 돌고 있는가 (decisions.md 306번, docs/app.md). 앱이 운영 웹 주소를 그대로 띄우는 때도
 * 다리(bridge)가 심어져 true다. 앱에서는 서비스 워커를 등록하지 않고(화면은 앱이 들고 있거나 WebView가 알아서 캐시한다),
 * 애드센스 광고도 그리지 않는다(웹 광고를 앱 안에 넣는 것은 애드센스 정책에 어긋난다. 앱 광고는 AdMob으로 따로 붙인다).
 */
export const isNativeApp: boolean = Capacitor.isNativePlatform()
