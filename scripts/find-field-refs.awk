# Locate every read/write of a field in a javap -c dump, reporting the
# enclosing class and method for each reference.
#
# Usage: awk -v field=gm.I:Z -f scripts/find-field-refs.awk /tmp/dis-original.txt
/^[A-Za-z].*class [A-Za-z0-9_$.]+/ {
    for (i = 1; i <= NF; i++) {
        if ($i == "class") { cls = $(i + 1); break }
    }
    next
}
/^  [^ ].*\(.*\)/ { method = $0; sub(/^ +/, "", method); sub(/;$/, "", method); next }
/^ +[0-9]+: (get|put)static/ {
    if (index($0, "Field " field) > 0) {
        op = (index($0, "putstatic") > 0) ? "WRITE" : "READ "
        printf "%-6s %s :: %s\n", op, cls, method
    }
}
