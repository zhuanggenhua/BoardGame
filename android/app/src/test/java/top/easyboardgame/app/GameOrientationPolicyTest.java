package top.easyboardgame.app;

import static org.junit.Assert.assertEquals;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

public class GameOrientationPolicyTest {

    @Test
    public void unconfiguredGameDefaultsToLandscape() {
        assertEquals(
            GameOrientationPolicy.LANDSCAPE,
            GameOrientationPolicy.resolve(new HashMap<>(), "betrayal")
        );
    }

    @Test
    public void explicitPortraitGameRemainsPortrait() {
        Map<String, String> orientations = new HashMap<>();
        orientations.put("tictactoe", GameOrientationPolicy.PORTRAIT);

        assertEquals(
            GameOrientationPolicy.PORTRAIT,
            GameOrientationPolicy.resolve(orientations, "tictactoe")
        );
    }

    @Test
    public void invalidOrientationFallsBackToLandscape() {
        Map<String, String> orientations = new HashMap<>();
        orientations.put("betrayal", "unsupported");

        assertEquals(
            GameOrientationPolicy.LANDSCAPE,
            GameOrientationPolicy.resolve(orientations, "betrayal")
        );
    }
}
