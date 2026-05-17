package java.awt;

import java.awt.event.FocusListener;
import java.awt.event.KeyListener;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.awt.event.MouseWheelListener;
import java.awt.image.ImageObserver;
import java.awt.image.ImageProducer;

public class Component implements ImageObserver {
    public Object getPeer() {
        return null;
    }

    public Toolkit getToolkit() {
        return Toolkit.getDefaultToolkit();
    }

    public Object getTreeLock() {
        return this;
    }

    public Point getLocationOnScreen() {
        return new Point();
    }

    public void setCursor(Cursor cursor) {
    }

    public Graphics getGraphics() {
        return null;
    }

    public void repaint() {
    }

    public void paint(Graphics graphics) {
    }

    public void update(Graphics graphics) {
    }

    public Image createImage(int width, int height) {
        return null;
    }

    public void setBounds(int x, int y, int width, int height) {
    }

    public void setSize(int width, int height) {
    }

    public Dimension getSize() {
        return new Dimension();
    }

    public void setLocation(int x, int y) {
    }

    public void setVisible(boolean visible) {
    }

    public Container getParent() {
        return null;
    }

    public void setBackground(Color color) {
    }

    public void toFront() {
    }

    public boolean requestFocus() {
        return true;
    }

    public void setFocusTraversalKeysEnabled(boolean focusTraversalKeysEnabled) {
    }

    public void enableInputMethods(boolean enable) {
    }

    public Image createImage(ImageProducer producer) {
        return null;
    }

    public boolean prepareImage(Image image, ImageObserver observer) {
        return true;
    }

    public void addKeyListener(KeyListener listener) {
    }

    public void removeKeyListener(KeyListener listener) {
    }

    public void addFocusListener(FocusListener listener) {
    }

    public void removeFocusListener(FocusListener listener) {
    }

    public void addMouseListener(MouseListener listener) {
    }

    public void removeMouseListener(MouseListener listener) {
    }

    public void addMouseMotionListener(MouseMotionListener listener) {
    }

    public void removeMouseMotionListener(MouseMotionListener listener) {
    }

    public void addMouseWheelListener(MouseWheelListener listener) {
    }

    public void removeMouseWheelListener(MouseWheelListener listener) {
    }

    @Override
    public boolean imageUpdate(Image img, int infoflags, int x, int y, int width, int height) {
        return false;
    }
}
