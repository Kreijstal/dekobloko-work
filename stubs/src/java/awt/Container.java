package java.awt;

public class Container extends Component {
    public Container() {
    }

    public Dimension getSize() {
        return new Dimension(0, 0);
    }

    public Insets getInsets() {
        return new Insets(0, 0, 0, 0);
    }

    public void setLayout(LayoutManager manager) {
    }

    public Component add(Component component) {
        return component;
    }

    public void remove(Component component) {
    }
}
