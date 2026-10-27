// Native protocol oracle, compiled against the ORIGINAL local gamepack.
// Every service packet below is emitted and decoded by the game's own code.
import java.io.*;
import java.net.*;
import java.math.BigInteger;
import java.util.*;

public final class EscapeProtocolProbe {
    static DataInputStream in;
    static OutputStream out;
    static c cipher;
    static int checks;

    static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
        checks++;
    }

    static void flush() throws Exception {
        // Fragment writes deliberately: a TCP read is not a packet boundary.
        for (int i = 0; i < om.c.m; i++) out.write(om.c.g[i]);
        out.flush();
        om.c.m = 0;
    }

    static void receive(int expected) throws Exception {
        int opcode;
        do {
            cipher.g[0] = in.readByte(); cipher.m = 0;
            opcode = cipher.k(8);
        } while (opcode == 0);
        check(opcode == expected, "opcode " + opcode + " expected " + expected);
        int size = opcode == 2 ? in.readUnsignedShort() : opcode == 1 ? 16 : in.readUnsignedByte();
        byte[] body = new byte[size]; in.readFully(body);
        om.g = new c(body); hi.r = size;
    }

    static long base37(String name) {
        long value = 0;
        for (char ch : name.toLowerCase(Locale.ROOT).toCharArray())
            value = value * 37 + "_abcdefghijklmnopqrstuvwxyz0123456789".indexOf(ch);
        return value;
    }

    public static void main(String[] args) throws Exception {
        try { run(args); }
        catch (rn failure) {
            while (failure != null) {
                System.err.println(failure.g);
                if (failure.a instanceof rn) failure = (rn)failure.a;
                else { failure.a.printStackTrace(); break; }
            }
            throw new AssertionError("native client protocol probe failed");
        }
    }

    static void run(String[] args) throws Exception {
        int port = Integer.parseInt(args[0]);
        String username = args[2];
        try (Socket socket = new Socket("127.0.0.1", port)) {
            socket.setSoTimeout(10000);
            in = new DataInputStream(socket.getInputStream()); out = socket.getOutputStream();
            out.write(new byte[]{12,0,0,0,0,0,0,0,14,0}); out.flush();
            check(in.readUnsignedByte() == 0, "seed response");
            long challenge = in.readLong();
            int[] seed = {123,456,(int)(challenge >>> 32),(int)challenge};
            ByteArrayOutputStream innerBytes = new ByteArrayOutputStream();
            DataOutputStream inner = new DataOutputStream(innerBytes);
            for (int word : seed) inner.writeInt(word);
            inner.write(new byte[24]); inner.writeShort(0);
            long identity = args.length > 4 ? Long.parseLong(args[4]) : base37(username);
            n credentials = new n(64);
            new ld(identity, "pass123").a(credentials, (byte)-121);
            inner.write(credentials.g, 0, credentials.m);
            n encrypted = new n(4096);
            // gb.a is the game's real RSA/XTEA login encryptor.
            gb.a(new BigInteger(args[1]), false, BigInteger.valueOf(65537),
                 innerBytes.toByteArray(), encrypted, innerBytes.size(), 0);
            ByteArrayOutputStream bodyBytes = new ByteArrayOutputStream();
            DataOutputStream body = new DataOutputStream(bodyBytes);
            body.writeInt(1); body.writeLong(0); body.writeByte(0); body.writeByte(0);
            body.write(encrypted.g, 0, encrypted.m);
            DataOutputStream wire = new DataOutputStream(out);
            wire.writeByte(16); wire.writeShort(bodyBytes.size()); wire.write(bodyBytes.toByteArray()); wire.flush();
            int status = in.readUnsignedByte(), size = in.readUnsignedByte();
            byte[] success = new byte[size]; in.readFully(success);
            check(status == 0, "login status " + status + " " + new String(success, "windows-1252"));
            om.c = new c(4096); om.c.a(seed, (byte)107);
            int[] responseSeed = seed.clone();
            for (int i = 0; i < 4; i++) responseSeed[i] += 50;
            cipher = new c(1); cipher.a(responseSeed, (byte)85);

            dc progress = wc.a(0, 5, 1, (byte)-51); flush(); receive(4); dk.e(108457410);
            check(progress.g, "progress request completed");
            check(progress.h[0] == (args.length > 3 ? 3 : 0), "progress survives restart");
            cc completed = new cc(0, 2, 11,22,33,44);
            oc.a(5, (byte)-107, completed); flush(); receive(4); dk.e(108457410);
            check(completed.d == null, "progress acknowledged and unlinked");
            progress = wc.a(0, 5, 1, (byte)-51); flush(); receive(4); dk.e(108457410);
            check(progress.g && progress.h[0] == 3, "next level restored correctly");

            qd achievement = new qd(37, 0, 11,22,33,44);
            sc.a(achievement, 4, 1); flush(); receive(3); cg.c(103);
            check(achievement.d == null, "achievement acknowledged and unlinked");
            jh achievements = new jh(); bc.b.a(-12328, achievements);
            km.a(4, 122); flush(); receive(3); cg.c(103);
            check(achievements.h && (achievements.i[1] & (1 << 5)) != 0, "achievement bitmap above bit 31");

            bd saved = new bd(new byte[]{1,2,3,4,5}); rd.b.a(-12328, saved);
            r.a(-118, saved, 6); flush(); receive(5); ge.a((byte)124);
            check(saved.d == null, "saved data CRC acknowledged");
            ei loaded = bc.a(6, 86); flush(); receive(5); ge.a((byte)124);
            check(loaded.g && Arrays.equals(loaded.h, new byte[]{1,2,3,4,5}), "saved data and CRC decoded");

            ik score = new ik(0, 65535, 11,22,33,44, new int[]{123456});
            ml.a(score, 3, (byte)101); flush(); receive(2); ja.a((byte)-120);
            check(score.d == null && score.l == 123456, "score acknowledged");
            ij table = new ij(); table.n = 0; table.h = 10; table.j = 1;
            qd.n.a(-12328, table); aj.a(42, 3, table); flush(); receive(2);
            // The highscore decoder uses the name returned by login as column 0.
            ck.r = username; cc.k = sf.a(-83, username);
            ja.a((byte)-120);
            check(table.l && table.k[0][0] == 123456 && table.o[0][0] == 123456, "highscore table decoded");
            check(table.m[1][0].equals(username), "highscore player attribution");
            om.c.a(1, true); flush();
            check(in.read() == -1, "logout closes account connection");
            System.out.println("EscapeProtocolProbe checks=" + checks);
        }
    }
}
