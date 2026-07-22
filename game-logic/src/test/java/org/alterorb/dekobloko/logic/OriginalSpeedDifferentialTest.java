package org.alterorb.dekobloko.logic;

import java.lang.reflect.Field;
import java.util.Arrays;

/** Compares extracted timing constants with the untouched original classes. */
public final class OriginalSpeedDifferentialTest {
    public static void main(String[] args) throws Exception {
        int[] originalStandard = readStaticIntArray("mn", "b");
        int[] originalStamina = readStaticIntArray("pn", "eb");

        int[] extractedStandard = new int[11];
        for (int index = 0; index < 8; index++) {
            extractedStandard[index] = SpeedRules.masterChallengeTheme(index + 1).baseDropTicks();
        }
        int[] expectedStandardTail = {4, 2, 0};
        System.arraycopy(expectedStandardTail, 0, extractedStandard, 8, expectedStandardTail.length);

        int[] extractedStamina = new int[17];
        for (int index = 0; index < extractedStamina.length; index++) {
            extractedStamina[index] = SpeedRules.staminaStage(index).baseDropTicks();
        }

        if (!Arrays.equals(originalStandard, extractedStandard)) {
            throw new AssertionError("standard speed table differs from original: "
                    + Arrays.toString(originalStandard));
        }
        if (!Arrays.equals(originalStamina, extractedStamina)) {
            throw new AssertionError("Stamina speed table differs from original: "
                    + Arrays.toString(originalStamina));
        }
        System.out.println("OriginalSpeedDifferentialTest: original speed tables match");
    }

    private static int[] readStaticIntArray(String className, String fieldName) throws Exception {
        Class<?> type = Class.forName(className);
        Field field = type.getDeclaredField(fieldName);
        field.setAccessible(true);
        return ((int[]) field.get(null)).clone();
    }
}
