package com.ms.win32;

public final class User32 {
    private User32() {
    }

    public static int GetWindowLong(int hwnd, int index) {
        return 0;
    }

    public static int SetWindowLong(int hwnd, int index, int value) {
        return 0;
    }

    public static int SetWindowLong(int hwnd, int index, Object callback) {
        return 0;
    }

    public static int CallWindowProc(int previousProc, int hwnd, int message, int wParam, int lParam) {
        return 0;
    }

    public static int LoadCursor(int instance, int cursorName) {
        return 0;
    }

    public static int SetCursor(int cursor) {
        return 0;
    }

    public static int SendMessage(int hwnd, int message, int wParam, int lParam) {
        return 0;
    }

    public static boolean SetCursorPos(int x, int y) {
        return false;
    }
}
