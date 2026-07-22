package org.alterorb.dekobloko.logic;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Value result of a match or special-item resolution. */
public final class Resolution {
    private final List<MatchGroup> matches;
    private final Set<Position> removedCells;
    private final List<Shape> returnedShapes;

    Resolution(List<MatchGroup> matches, Set<Position> removedCells, List<Shape> returnedShapes) {
        this.matches = Collections.unmodifiableList(new ArrayList<MatchGroup>(matches));
        this.removedCells = Collections.unmodifiableSet(new LinkedHashSet<Position>(removedCells));
        this.returnedShapes = Collections.unmodifiableList(new ArrayList<Shape>(returnedShapes));
    }

    static Resolution special(Set<Position> removedCells, List<Shape> returnedShapes) {
        return new Resolution(Collections.<MatchGroup>emptyList(), removedCells, returnedShapes);
    }

    public List<MatchGroup> matches() {
        return matches;
    }

    public Set<Position> removedCells() {
        return removedCells;
    }

    public List<Shape> returnedShapes() {
        return returnedShapes;
    }

    public boolean changedBoard() {
        return !removedCells.isEmpty();
    }
}
