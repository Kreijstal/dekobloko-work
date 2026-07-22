package org.alterorb.dekobloko.logic;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

public final class MatchGroup {
    private final int color;
    private final Set<Position> positions;

    MatchGroup(int color, Set<Position> positions) {
        this.color = color;
        this.positions = Collections.unmodifiableSet(new LinkedHashSet<Position>(positions));
    }

    public int color() {
        return color;
    }

    public Set<Position> positions() {
        return positions;
    }

    public int size() {
        return positions.size();
    }
}
