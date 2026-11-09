package com.kyunglock.investorgame;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * 앱 글자 크기는 휴대폰 글꼴 크기 설정을 따르지 않고 디자인한 크기로 고정한다 (decisions.md 417번, #578). 안드로이드 WebView는 시스템
 * 글꼴 크기를 textZoom으로 반영해 px로 박은 글자까지 키우는데, 상자·장면은 그대로라 줄바꿈·넘침이 생긴다.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    fixTextZoom();
  }

  @Override
  public void onResume() {
    super.onResume();
    // 켠 채 글꼴 크기를 바꾸면 액티비티가 다시 만들어지지만(configChanges에 fontScale이 없다), 돌아올 때마다 한 번 더 맞춘다.
    fixTextZoom();
  }

  private void fixTextZoom() {
    if (getBridge() == null) return;
    WebView view = getBridge().getWebView();
    if (view != null) view.getSettings().setTextZoom(100);
  }
}
