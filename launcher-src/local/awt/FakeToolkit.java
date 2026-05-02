package local.awt;

import local.Trace;

import java.awt.AWTException;
import java.awt.Button;
import java.awt.Canvas;
import java.awt.Checkbox;
import java.awt.CheckboxMenuItem;
import java.awt.Choice;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Desktop;
import java.awt.Dialog;
import java.awt.Dimension;
import java.awt.EventQueue;
import java.awt.FileDialog;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Frame;
import java.awt.Image;
import java.awt.Insets;
import java.awt.JobAttributes;
import java.awt.Label;
import java.awt.List;
import java.awt.Menu;
import java.awt.MenuBar;
import java.awt.MenuItem;
import java.awt.PageAttributes;
import java.awt.Panel;
import java.awt.Point;
import java.awt.PopupMenu;
import java.awt.PrintJob;
import java.awt.ScrollPane;
import java.awt.Scrollbar;
import java.awt.TextArea;
import java.awt.TextField;
import java.awt.Toolkit;
import java.awt.Window;
import java.awt.datatransfer.Clipboard;
import java.awt.dnd.DragGestureEvent;
import java.awt.dnd.DragGestureListener;
import java.awt.dnd.DragGestureRecognizer;
import java.awt.dnd.DragSource;
import java.awt.dnd.InvalidDnDOperationException;
import java.awt.dnd.peer.DragSourceContextPeer;
import java.awt.font.TextAttribute;
import java.awt.im.InputMethodHighlight;
import java.awt.image.BufferedImage;
import java.awt.image.ColorModel;
import java.awt.image.ImageObserver;
import java.awt.image.ImageProducer;
import java.awt.peer.ButtonPeer;
import java.awt.peer.CanvasPeer;
import java.awt.peer.CheckboxMenuItemPeer;
import java.awt.peer.CheckboxPeer;
import java.awt.peer.ChoicePeer;
import java.awt.peer.DesktopPeer;
import java.awt.peer.DialogPeer;
import java.awt.peer.FileDialogPeer;
import java.awt.peer.FontPeer;
import java.awt.peer.FramePeer;
import java.awt.peer.LabelPeer;
import java.awt.peer.ListPeer;
import java.awt.peer.MenuBarPeer;
import java.awt.peer.MenuItemPeer;
import java.awt.peer.MenuPeer;
import java.awt.peer.PanelPeer;
import java.awt.peer.PopupMenuPeer;
import java.awt.peer.ScrollPanePeer;
import java.awt.peer.ScrollbarPeer;
import java.awt.peer.TextAreaPeer;
import java.awt.peer.TextFieldPeer;
import java.awt.peer.WindowPeer;
import java.net.URL;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Map;
import java.util.Properties;

public class FakeToolkit extends Toolkit implements sun.awt.KeyboardFocusManagerPeerProvider {
    private final EventQueue eventQueue = new EventQueue();
    private final Clipboard clipboard = new Clipboard("fake-system-clipboard");
    private final java.awt.peer.KeyboardFocusManagerPeer keyboardFocusManagerPeer = new FakeKeyboardFocusManagerPeer();
    private boolean eventQueueLogged;

    public FakeToolkit() {
        Trace.log("fakeToolkit.<init>");
    }

    @Override
    protected DesktopPeer createDesktopPeer(Desktop target) {
        Trace.log("fakeToolkit.createDesktopPeer");
        return null;
    }

    @Override
    protected ButtonPeer createButton(Button target) {
        Trace.log("fakeToolkit.createButton");
        return peer(ButtonPeer.class, "Button");
    }

    @Override
    protected TextFieldPeer createTextField(TextField target) {
        Trace.log("fakeToolkit.createTextField");
        return peer(TextFieldPeer.class, "TextField");
    }

    @Override
    protected LabelPeer createLabel(Label target) {
        Trace.log("fakeToolkit.createLabel");
        return peer(LabelPeer.class, "Label");
    }

    @Override
    protected ListPeer createList(List target) {
        Trace.log("fakeToolkit.createList");
        return peer(ListPeer.class, "List");
    }

    @Override
    protected CheckboxPeer createCheckbox(Checkbox target) {
        Trace.log("fakeToolkit.createCheckbox");
        return peer(CheckboxPeer.class, "Checkbox");
    }

    @Override
    protected ScrollbarPeer createScrollbar(Scrollbar target) {
        Trace.log("fakeToolkit.createScrollbar");
        return peer(ScrollbarPeer.class, "Scrollbar");
    }

    @Override
    protected ScrollPanePeer createScrollPane(ScrollPane target) {
        Trace.log("fakeToolkit.createScrollPane");
        return peer(ScrollPanePeer.class, "ScrollPane");
    }

    @Override
    protected TextAreaPeer createTextArea(TextArea target) {
        Trace.log("fakeToolkit.createTextArea");
        return peer(TextAreaPeer.class, "TextArea");
    }

    @Override
    protected ChoicePeer createChoice(Choice target) {
        Trace.log("fakeToolkit.createChoice");
        return peer(ChoicePeer.class, "Choice");
    }

    @Override
    protected FramePeer createFrame(Frame target) {
        Trace.log("fakeToolkit.createFrame title=" + target.getTitle());
        return peer(FramePeer.class, "Frame");
    }

    @Override
    protected CanvasPeer createCanvas(Canvas target) {
        Trace.log("fakeToolkit.createCanvas");
        return peer(CanvasPeer.class, "Canvas");
    }

    @Override
    protected PanelPeer createPanel(Panel target) {
        Trace.log("fakeToolkit.createPanel");
        return peer(PanelPeer.class, "Panel");
    }

    @Override
    protected WindowPeer createWindow(Window target) {
        Trace.log("fakeToolkit.createWindow");
        return peer(WindowPeer.class, "Window");
    }

    @Override
    protected DialogPeer createDialog(Dialog target) {
        Trace.log("fakeToolkit.createDialog");
        return peer(DialogPeer.class, "Dialog");
    }

    @Override
    protected MenuBarPeer createMenuBar(MenuBar target) {
        Trace.log("fakeToolkit.createMenuBar");
        return peer(MenuBarPeer.class, "MenuBar");
    }

    @Override
    protected MenuPeer createMenu(Menu target) {
        Trace.log("fakeToolkit.createMenu");
        return peer(MenuPeer.class, "Menu");
    }

    @Override
    protected PopupMenuPeer createPopupMenu(PopupMenu target) {
        Trace.log("fakeToolkit.createPopupMenu");
        return peer(PopupMenuPeer.class, "PopupMenu");
    }

    @Override
    protected MenuItemPeer createMenuItem(MenuItem target) {
        Trace.log("fakeToolkit.createMenuItem");
        return peer(MenuItemPeer.class, "MenuItem");
    }

    @Override
    protected FileDialogPeer createFileDialog(FileDialog target) {
        Trace.log("fakeToolkit.createFileDialog");
        return peer(FileDialogPeer.class, "FileDialog");
    }

    @Override
    protected CheckboxMenuItemPeer createCheckboxMenuItem(CheckboxMenuItem target) {
        Trace.log("fakeToolkit.createCheckboxMenuItem");
        return peer(CheckboxMenuItemPeer.class, "CheckboxMenuItem");
    }

    @Override
    protected FontPeer getFontPeer(String name, int style) {
        Trace.log("fakeToolkit.getFontPeer name=" + name + " style=" + style);
        return null;
    }

    @Override
    public Dimension getScreenSize() {
        Trace.log("fakeToolkit.getScreenSize");
        return new Dimension(1024, 768);
    }

    @Override
    public int getScreenResolution() {
        Trace.log("fakeToolkit.getScreenResolution");
        return 96;
    }

    @Override
    public ColorModel getColorModel() {
        Trace.log("fakeToolkit.getColorModel");
        return ColorModel.getRGBdefault();
    }

    @Override
    public String[] getFontList() {
        Trace.log("fakeToolkit.getFontList");
        return new String[] { "Dialog", "SansSerif", "Serif", "Monospaced" };
    }

    @Override
    public FontMetrics getFontMetrics(Font font) {
        Trace.log("fakeToolkit.getFontMetrics " + font);
        return new Canvas().getFontMetrics(font);
    }

    @Override
    public void sync() {
        Trace.log("fakeToolkit.sync");
    }

    @Override
    public Image getImage(String filename) {
        Trace.log("fakeToolkit.getImage " + filename);
        return createImage(filename);
    }

    @Override
    public Image getImage(URL url) {
        Trace.log("fakeToolkit.getImage " + url);
        return createImage(url);
    }

    @Override
    public Image createImage(String filename) {
        Trace.log("fakeToolkit.createImage " + filename);
        return new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
    }

    @Override
    public Image createImage(URL url) {
        Trace.log("fakeToolkit.createImage " + url);
        return new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
    }

    @Override
    public boolean prepareImage(Image image, int width, int height, ImageObserver observer) {
        Trace.log("fakeToolkit.prepareImage " + width + "x" + height);
        return true;
    }

    @Override
    public int checkImage(Image image, int width, int height, ImageObserver observer) {
        Trace.log("fakeToolkit.checkImage " + width + "x" + height);
        return ImageObserver.ALLBITS;
    }

    @Override
    public Image createImage(ImageProducer producer) {
        Trace.log("fakeToolkit.createImage producer");
        return new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
    }

    @Override
    public Image createImage(byte[] data, int offset, int length) {
        Trace.log("fakeToolkit.createImage bytes length=" + length);
        return new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
    }

    @Override
    public PrintJob getPrintJob(Frame frame, String jobtitle, Properties props) {
        Trace.log("fakeToolkit.getPrintJob " + jobtitle);
        return null;
    }

    @Override
    public PrintJob getPrintJob(Frame frame, String jobtitle, JobAttributes jobAttributes, PageAttributes pageAttributes) {
        Trace.log("fakeToolkit.getPrintJob2 " + jobtitle);
        return null;
    }

    @Override
    public void beep() {
        Trace.log("fakeToolkit.beep");
    }

    @Override
    public Clipboard getSystemClipboard() {
        Trace.log("fakeToolkit.getSystemClipboard");
        return clipboard;
    }

    @Override
    public Cursor createCustomCursor(Image cursor, Point hotSpot, String name) {
        Trace.log("fakeToolkit.createCustomCursor name=" + name + " hotSpot=" + hotSpot);
        return Cursor.getDefaultCursor();
    }

    @Override
    public Dimension getBestCursorSize(int preferredWidth, int preferredHeight) {
        Trace.log("fakeToolkit.getBestCursorSize " + preferredWidth + "x" + preferredHeight);
        return new Dimension(1, 1);
    }

    @Override
    public int getMaximumCursorColors() {
        Trace.log("fakeToolkit.getMaximumCursorColors");
        return 2;
    }

    @Override
    public boolean isFrameStateSupported(int state) {
        Trace.log("fakeToolkit.isFrameStateSupported " + state);
        return false;
    }

    @Override
    protected EventQueue getSystemEventQueueImpl() {
        if (!eventQueueLogged) {
            Trace.log("fakeToolkit.getSystemEventQueueImpl");
            eventQueueLogged = true;
        }
        return eventQueue;
    }

    @Override
    public DragSourceContextPeer createDragSourceContextPeer(DragGestureEvent event) throws InvalidDnDOperationException {
        Trace.log("fakeToolkit.createDragSourceContextPeer");
        throw new InvalidDnDOperationException("FakeToolkit does not support drag and drop");
    }

    @Override
    public <T extends DragGestureRecognizer> T createDragGestureRecognizer(Class<T> recognizerClass, DragSource dragSource,
                                                                           java.awt.Component component, int actions,
                                                                           DragGestureListener listener) {
        Trace.log("fakeToolkit.createDragGestureRecognizer");
        return null;
    }

    @Override
    public boolean isModalityTypeSupported(Dialog.ModalityType modalityType) {
        Trace.log("fakeToolkit.isModalityTypeSupported " + modalityType);
        return false;
    }

    @Override
    public boolean isModalExclusionTypeSupported(Dialog.ModalExclusionType modalExclusionType) {
        Trace.log("fakeToolkit.isModalExclusionTypeSupported " + modalExclusionType);
        return false;
    }

    @Override
    public Map<TextAttribute, ?> mapInputMethodHighlight(InputMethodHighlight highlight) {
        Trace.log("fakeToolkit.mapInputMethodHighlight");
        return java.util.Collections.emptyMap();
    }

    private static <T> T peer(Class<T> peerType, String label) {
        InvocationHandler handler = new FakePeerHandler(label);
        Object proxy = Proxy.newProxyInstance(FakeToolkit.class.getClassLoader(), new Class<?>[] { peerType }, handler);
        return peerType.cast(proxy);
    }

    private static final class FakePeerHandler implements InvocationHandler {
        private final String label;

        private FakePeerHandler(String label) {
            this.label = label;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) {
            String name = method.getName();
            if ("toString".equals(name)) {
                return "Fake" + label + "Peer";
            }
            if ("hashCode".equals(name)) {
                return System.identityHashCode(proxy);
            }
            if ("equals".equals(name)) {
                return proxy == args[0];
            }

            Trace.log("fakePeer." + label + "." + name);
            Class<?> returnType = method.getReturnType();
            if (returnType == Void.TYPE) {
                return null;
            }
            if (returnType == Boolean.TYPE) {
                return Boolean.FALSE;
            }
            if (returnType == Integer.TYPE) {
                return Integer.valueOf(0);
            }
            if (returnType == Long.TYPE) {
                return Long.valueOf(0L);
            }
            if (returnType == Float.TYPE) {
                return Float.valueOf(0.0f);
            }
            if (returnType == Double.TYPE) {
                return Double.valueOf(0.0d);
            }
            if (returnType == Character.TYPE) {
                return Character.valueOf('\0');
            }
            if (returnType == Byte.TYPE) {
                return Byte.valueOf((byte) 0);
            }
            if (returnType == Short.TYPE) {
                return Short.valueOf((short) 0);
            }
            if (returnType == Dimension.class) {
                return new Dimension(0, 0);
            }
            if (returnType == Point.class) {
                return new Point(0, 0);
            }
            if (returnType == Insets.class) {
                return new Insets(0, 0, 0, 0);
            }
            if (returnType == ColorModel.class) {
                return ColorModel.getRGBdefault();
            }
            if (returnType == java.awt.Graphics.class) {
                return new BufferedImage(1024, 768, BufferedImage.TYPE_INT_ARGB).getGraphics();
            }
            if (returnType == FontMetrics.class) {
                return new Canvas().getFontMetrics(new Font("Dialog", Font.PLAIN, 12));
            }
            return null;
        }
    }

    @Override
    public java.awt.peer.KeyboardFocusManagerPeer getKeyboardFocusManagerPeer() {
        Trace.log("fakeToolkit.getKeyboardFocusManagerPeer");
        return keyboardFocusManagerPeer;
    }

    private static final class FakeKeyboardFocusManagerPeer implements java.awt.peer.KeyboardFocusManagerPeer {
        private Window focusedWindow;
        private java.awt.Component focusOwner;

        @Override
        public void setCurrentFocusedWindow(Window window) {
            Trace.log("fakeKeyboardFocusManagerPeer.setCurrentFocusedWindow " + window);
            focusedWindow = window;
        }

        @Override
        public Window getCurrentFocusedWindow() {
            Trace.log("fakeKeyboardFocusManagerPeer.getCurrentFocusedWindow");
            return focusedWindow;
        }

        @Override
        public void setCurrentFocusOwner(java.awt.Component component) {
            Trace.log("fakeKeyboardFocusManagerPeer.setCurrentFocusOwner " + component);
            focusOwner = component;
        }

        @Override
        public java.awt.Component getCurrentFocusOwner() {
            Trace.log("fakeKeyboardFocusManagerPeer.getCurrentFocusOwner");
            return focusOwner;
        }

        @Override
        public void clearGlobalFocusOwner(Window activeWindow) {
            Trace.log("fakeKeyboardFocusManagerPeer.clearGlobalFocusOwner " + activeWindow);
            focusOwner = null;
        }
    }
}
