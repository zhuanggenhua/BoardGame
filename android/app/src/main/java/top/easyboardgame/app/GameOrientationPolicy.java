package top.easyboardgame.app;

import java.util.Map;

final class GameOrientationPolicy {

    static final String LANDSCAPE = "landscape";
    static final String PORTRAIT = "portrait";

    private GameOrientationPolicy() {}

    static String resolve(Map<String, String> gameOrientations, String gameId) {
        String configuredOrientation = gameOrientations.get(gameId);
        return PORTRAIT.equals(configuredOrientation) ? PORTRAIT : LANDSCAPE;
    }
}
