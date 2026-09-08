public class ReplayFixture {
    public int total;
    public synchronized void mix(int[] values) {
        for (int i = 0; i < values.length; i++) {
            total += values[i];
            values[i] = total + 7 * i;
        }
    }
    public static void main(String[] args) {
        ReplayFixture receiver = new ReplayFixture();
        receiver.total = 7;
        int[] values = {1, 2, 3, 4};
        for (int block = 0; block < 32; block++) receiver.mix(values);
        System.out.println(receiver.total);
        for (int value : values) System.out.println(value);
    }
}
