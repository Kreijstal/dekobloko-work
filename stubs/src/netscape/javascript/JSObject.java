package netscape.javascript;

import java.applet.Applet;

public abstract class JSObject {
    public abstract Object call(String methodName, Object[] args);

    public abstract Object eval(String expression);

    public abstract Object getMember(String name);

    public abstract void setMember(String name, Object value);

    public abstract void removeMember(String name);

    public abstract Object getSlot(int index);

    public abstract void setSlot(int index, Object value);

    public static JSObject getWindow(Applet applet) {
        return null;
    }
}
