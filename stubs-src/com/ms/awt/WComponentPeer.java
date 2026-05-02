package com.ms.awt;

import java.awt.peer.ComponentPeer;

public interface WComponentPeer extends ComponentPeer {
    int getHwnd();

    int getTopHwnd();
}
