"""Independent classfile/instruction/API verifier; never loads application code.

Allows the reviewed namespace translation and exactly the compiler-proven class
name literals. All executable operands, branch destinations, handlers, frames,
modifiers and encountered attributes are compared. Constant pool indexes and
compact/wide encodings are normalized, not ignored.
"""
import collections
import hashlib
import json
import re
import struct
import sys
import zipfile
from pathlib import Path

if not __debug__:
    raise SystemExit('Verification assertions must be enabled; do not use Python -O.')

if len(sys.argv) == 4 and sys.argv[1] == 'inspect':
    mode = 'inspect'
    original_jar, output = map(Path, sys.argv[2:])
    assert not output.exists()
elif len(sys.argv) == 8 and sys.argv[1] == 'verify':
    mode = 'verify'
    planfile, named_classes, restored_jar, original_jar, policyfile, output = map(Path, sys.argv[2:])
    assert not output.exists()
    plan = json.loads(planfile.read_text())
    policy = json.loads(policyfile.read_text())
    classmap = {r['current']: r['target'] for r in plan['classes']}
    sourcefiles = {r['current']: r['sourceFile'] for r in plan['classes']}
    membermaps = {
        'fields': {(r['owner'], r['name'], r['descriptor']): r['targetName'] for r in plan['fields']},
        'methods': {(r['owner'], r['name'], r['descriptor']): r['targetName'] for r in [*plan['methods'], *plan['sourceGeneratedMethods']]},
    }
    literalplan = collections.Counter((r['sourceFile'], r['line'], r['currentValue'], r['targetValue']) for r in plan['classNameLiteralSites'])
    literalhits = collections.Counter()
    counts = collections.Counter()
    attributes_seen = collections.Counter()
else:
    raise SystemExit('Usage: inspect original.jar api.json | verify plan.json classes restored.jar original.jar policy.json report.json')

class Reader:
    def __init__(self, data): self.data, self.pos = data, 0
    def take(self, n):
        result = self.data[self.pos:self.pos+n]
        assert len(result) == n
        self.pos += n
        return result
    def number(self, fmt): return struct.unpack('>' + fmt, self.take(struct.calcsize('>' + fmt)))[0]
    def u1(self): return self.number('B')
    def u2(self): return self.number('H')
    def u4(self): return self.number('I')
    def done(self): assert self.pos == len(self.data), (self.pos, len(self.data))

def attributes(reader, cp):
    result = []
    for _ in range(reader.u2()):
        name = cp[reader.u2()][1]
        result.append((name, reader.take(reader.u4())))
    assert len({n for n, _ in result}) == len(result), 'duplicate attributes require separate handling'
    return result

class ClassFile:
    def __init__(self, data):
        r = Reader(data)
        assert r.u4() == 0xcafebabe
        self.version = (r.u2(), r.u2())
        self.cp = [None] * r.u2()
        i = 1
        while i < len(self.cp):
            tag = r.u1()
            if tag == 1: value = (tag, r.take(r.u2()).replace(b'\xc0\x80', b'\0').decode('utf-8', 'surrogatepass'))
            elif tag in (3, 4): value = (tag, r.take(4).hex())
            elif tag in (5, 6): value = (tag, r.take(8).hex())
            elif tag in (7, 8, 16, 19, 20): value = (tag, r.u2())
            elif tag in (9, 10, 11, 12, 17, 18): value = (tag, r.u2(), r.u2())
            elif tag == 15: value = (tag, r.u1(), r.u2())
            else: raise AssertionError(('constant-pool tag', tag))
            self.cp[i] = value
            i += 2 if tag in (5, 6) else 1
        self.access = r.u2()
        self.name, self.parent = self.classname(r.u2()), self.classname(r.u2())
        self.interfaces = [self.classname(r.u2()) for _ in range(r.u2())]
        for kind in ('fields', 'methods'):
            rows = []
            for _ in range(r.u2()):
                rows.append(dict(access=r.u2(), name=self.utf(r.u2()), desc=self.utf(r.u2()), attrs=attributes(r, self.cp)))
            setattr(self, kind, rows)
        self.attrs = attributes(r, self.cp)
        r.done()
    def utf(self, index):
        assert self.cp[index][0] == 1
        return self.cp[index][1]
    def classname(self, index):
        if not index: return None
        assert self.cp[index][0] == 7
        return self.utf(self.cp[index][1])
    def nametype(self, index):
        tag, name, desc = self.cp[index]
        assert tag == 12
        return self.utf(name), self.utf(desc)

def load_jar(path):
    result = {}
    with zipfile.ZipFile(path) as jar:
        names = jar.namelist()
        assert len(set(names)) == len(names), 'duplicate archive entries'
        for name in sorted(names):
            if not name.endswith('.class'): continue
            c = ClassFile(jar.read(name))
            assert name == c.name + '.class' and c.name not in result
            result[c.name] = c
    return result

def api(c):
    return dict(name=c.name, parent=c.parent, interfaces=c.interfaces, access=c.access,
                fields=[{k:m[k] for k in ('name','desc','access')} for m in c.fields],
                methods=[{k:m[k] for k in ('name','desc','access')} for m in c.methods])

if mode == 'inspect':
    output.write_text(json.dumps(dict(jarSha256=hashlib.sha256(original_jar.read_bytes()).hexdigest(), classes=[api(c) for c in load_jar(original_jar).values()]), indent=2)+'\n')
    raise SystemExit(0)

inputs = {}
for file in sorted(named_classes.rglob('*.class')):
    c = ClassFile(file.read_bytes())
    assert file.relative_to(named_classes).as_posix() == c.name + '.class'
    assert c.name not in inputs
    inputs[c.name] = c
assert inputs.keys() == classmap.keys()

def descriptor(value): return re.sub(r'L([^;]+);', lambda m: 'L' + classmap.get(m[1], m[1]) + ';', value)
def classname(value, translate):
    if not translate or value is None: return value
    return descriptor(value) if value.startswith('[') else classmap.get(value, value)
def signature(value, translate):
    if not translate: return value
    return re.sub(r'L([^;<]+)', lambda m: 'L' + classmap.get(m[1], m[1]), value)

def own(owner, name, desc, kind):
    c = inputs.get(owner)
    if c and any((m['name'], m['desc']) == (name, desc) for m in getattr(c, kind)):
        return membermaps[kind].get((owner, name, desc), name)
    return None

def interface_names(owners, name, desc, kind, visited=None):
    visited = set() if visited is None else visited
    found = set()
    for owner in owners:
        if owner in visited: continue
        visited.add(owner)
        result = own(owner, name, desc, kind)
        if result is not None: found.add(result)
        elif owner in inputs: found.update(interface_names(inputs[owner].interfaces, name, desc, kind, visited))
    return found

def member_name(owner, name, desc, kind, translate):
    if not translate or name in ('<init>', '<clinit>'): return name
    if owner not in inputs: return name
    # Independently follow JVM field lookup: owner, superinterfaces, superclass.
    if kind == 'fields':
        c = inputs[owner]
        found = own(owner, name, desc, kind)
        if found is not None: return found
        choices = interface_names(c.interfaces, name, desc, kind)
        assert len(choices) <= 1, ('ambiguous interface fields', owner, name, desc, choices)
        if choices: return next(iter(choices))
        return member_name(c.parent, name, desc, kind, True)
    # Method lookup searches the complete superclass chain before interfaces.
    chain, cursor = [], owner
    while cursor in inputs:
        c = inputs[cursor]
        chain.append(c)
        found = own(cursor, name, desc, kind)
        if found is not None: return found
        cursor = c.parent
    choices = interface_names([i for c in chain for i in c.interfaces], name, desc, kind)
    assert len(choices) <= 1, ('ambiguous interface methods', owner, name, desc, choices)
    return next(iter(choices)) if choices else name

def constant(c, index, translate):
    value = c.cp[index]
    tag = value[0]
    if tag in (3, 4, 5, 6): return value
    if tag == 7: return (tag, classname(c.classname(index), translate))
    if tag == 8: return (tag, c.utf(value[1]))
    if tag in (9, 10, 11):
        owner = c.classname(value[1]); name, desc = c.nametype(value[2])
        return (tag, classname(owner, translate), member_name(owner, name, desc, 'fields' if tag == 9 else 'methods', translate), descriptor(desc) if translate else desc)
    # This pinned compilation contains no dynamic, method-handle/type or module constants.
    raise AssertionError(('unhandled executable constant', tag))

def decode(code):
    r = Reader(code); rows = []
    while r.pos < len(code):
        start = r.pos; op = r.u1(); args = ()
        if op == 16: args = (r.number('b'),)
        elif op == 17: args = (r.number('h'),)
        elif op == 18: args = ('cp', r.u1())
        elif op in (19, 20): args = ('cp', r.u2()); op = 18 if op == 19 else 20
        elif op in (*range(21, 26), *range(54, 59), 169): args = (r.u1(),)
        elif 26 <= op <= 45: op, args = 21 + (op-26)//4, ((op-26)%4,)
        elif 59 <= op <= 78: op, args = 54 + (op-59)//4, ((op-59)%4,)
        elif op == 132: args = (r.u1(), r.number('b'))
        elif op in (*range(153, 169), 198, 199): args = ('branch', start + r.number('h'))
        elif op in (200, 201): args = ('branch', start + r.number('i')); op -= 33
        elif op in (170, 171):
            padding = r.take((-r.pos) % 4); assert not any(padding)
            default = start + r.number('i')
            if op == 170:
                low, high = r.number('i'), r.number('i'); assert high >= low
                cases = [(key, start + r.number('i')) for key in range(low, high+1)]
            else:
                size = r.number('i'); assert size >= 0
                cases = [(r.number('i'), start + r.number('i')) for _ in range(size)]
            args = ('switch', default, cases)
        elif op in (*range(178, 185), 187, 189, 192, 193): args = ('cp', r.u2())
        elif op == 185:
            args = ('cp', r.u2(), r.u1()); assert r.u1() == 0
        elif op == 186: raise AssertionError('invokedynamic not present in inspected compilation')
        elif op == 188: args = (r.u1(),)
        elif op == 196:
            op = r.u1(); index = r.u2()
            assert op in (*range(21, 26), *range(54, 59), 132, 169)
            args = (index, r.number('h')) if op == 132 else (index,)
        elif op == 197: args = ('cp', r.u2(), r.u1())
        else: assert 0 <= op <= 195, ('unknown opcode', op)
        rows.append((start, op, args))
    positions = {offset: i for i, (offset, _, _) in enumerate(rows)}
    positions[len(code)] = len(rows)
    return rows, positions

def code_parts(data):
    r = Reader(data); stack, locals_count = r.u2(), r.u2(); code = r.take(r.u4())
    handlers = [(r.u2(), r.u2(), r.u2(), r.u2()) for _ in range(r.u2())]
    return r, stack, locals_count, code, handlers

def initial_locals(c, m, translate):
    result = []
    if not m['access'] & 8: result.append((6,) if m['name'] == '<init>' else (7, classname(c.name, translate)))
    for typ in re.findall(r'\[*L[^;]+;|\[*[BCDFIJSZ]', m['desc'].split(')')[0][1:]):
        if typ.startswith('L'): result.append((7, classname(typ[1:-1], translate)))
        elif typ.startswith('['): result.append((7, classname(typ, translate)))
        else: result.append(({'F':2, 'D':3, 'J':4}.get(typ,1),))
    return result

def stack_map(c, m, data, positions, translate):
    r = Reader(data); result = []; offset = -1; locals_state = initial_locals(c, m, translate)
    def typ():
        tag = r.u1(); assert tag <= 8
        if tag == 7: return (tag, classname(c.classname(r.u2()), translate))
        if tag == 8: return (tag, positions[r.u2()])
        return (tag,)
    for _ in range(r.u2()):
        tag = r.u1(); stack = []
        if tag <= 63: delta = tag
        elif tag <= 127: delta = tag - 64; stack = [typ()]
        elif tag == 247: delta = r.u2(); stack = [typ()]
        elif 248 <= tag <= 250: delta = r.u2(); locals_state = locals_state[:-(251-tag)]
        elif tag == 251: delta = r.u2()
        elif 252 <= tag <= 254: delta = r.u2(); locals_state = [*locals_state, *(typ() for _ in range(tag-251))]
        elif tag == 255: delta = r.u2(); locals_state = [typ() for _ in range(r.u2())]; stack = [typ() for _ in range(r.u2())]
        else: raise AssertionError(('reserved frame tag', tag))
        offset += delta + 1
        result.append((positions[offset], tuple(locals_state), tuple(stack)))
    r.done()
    return result

def normalized_attrs(c, attrs, translate, scope, method=None, positions=None):
    result = []
    for name, data in attrs:
        attributes_seen[(translate, scope, name)] += 1
        r = Reader(data)
        if name == 'Code': value = normalized_code(c, method, data, translate); r.take(len(data))
        elif name == 'SourceFile': value = c.utf(r.u2())
        elif name == 'Exceptions': value = [classname(c.classname(r.u2()), translate) for _ in range(r.u2())]
        elif name == 'Signature': value = signature(c.utf(r.u2()), translate)
        elif name == 'EnclosingMethod':
            owner = c.classname(r.u2()); index = r.u2(); member = c.nametype(index) if index else None
            value = (classname(owner, translate), (member_name(owner, *member, 'methods', translate), descriptor(member[1]) if translate else member[1]) if member else None)
        elif name == 'InnerClasses':
            value = []
            for _ in range(r.u2()):
                inner, outer, simple, access = r.u2(), r.u2(), r.u2(), r.u2()
                value.append((classname(c.classname(inner), translate), classname(c.classname(outer), translate), c.utf(simple) if simple else None, access))
        elif name == 'LineNumberTable': value = [(positions[r.u2()], r.u2()) for _ in range(r.u2())]
        elif name == 'StackMapTable': value = stack_map(c, method, data, positions, translate); r.take(len(data))
        else: raise AssertionError(('unhandled attribute', scope, name))
        r.done(); result.append((name, value))
    return sorted(result, key=lambda a: a[0])

def normalized_code(c, m, data, translate):
    r, stack, locals_count, code, handlers = code_parts(data)
    attrs = attributes(r, c.cp); r.done()
    rows, positions = decode(code)
    lines = []
    for name, payload in attrs:
        if name == 'LineNumberTable':
            lr = Reader(payload); lines = [(lr.u2(), lr.u2()) for _ in range(lr.u2())]; lr.done()
    instructions = []
    for offset, op, args in rows:
        counts['inputInstructions' if translate else 'outputInstructions'] += 1
        if args and args[0] == 'cp':
            con = constant(c, args[1], translate)
            if translate and con[0] == 8:
                line = next((line for pos, line in reversed(lines) if pos <= offset), None)
                sites = [s for s in literalplan if s[:3] == (sourcefiles[c.name], line, con[1])]
                assert len(sites) <= 1
                if sites:
                    site = sites[0]; literalhits[site] += 1; con = (8, site[3])
            args = ('cp', con, *args[2:])
        elif args and args[0] == 'branch': args = ('branch', positions[args[1]])
        elif args and args[0] == 'switch': args = ('switch', positions[args[1]], [(key, positions[dest]) for key, dest in args[2]])
        instructions.append((op, args))
    counts['inputHandlers' if translate else 'outputHandlers'] += len(handlers)
    normalized_handlers = [(positions[start], positions[end], positions[handler], classname(c.classname(catch), translate)) for start, end, handler, catch in handlers]
    return (stack, locals_count, instructions, normalized_handlers, normalized_attrs(c, attrs, translate, 'code', m, positions))

def normalize_class(c, translate):
    value = dict(version=c.version, access=c.access, name=classname(c.name, translate), parent=classname(c.parent, translate), interfaces=[classname(n, translate) for n in c.interfaces], attrs=normalized_attrs(c, c.attrs, translate, 'class'))
    for kind in ('fields', 'methods'):
        value[kind] = []
        for m in getattr(c, kind):
            value[kind].append(dict(access=m['access'], name=member_name(c.name, m['name'], m['desc'], kind, translate), desc=descriptor(m['desc']) if translate else m['desc'], attrs=normalized_attrs(c, m['attrs'], translate, kind, m)))
            counts[('input' if translate else 'output') + kind.title()] += 1
    return value

actual_classes = {}
with zipfile.ZipFile(restored_jar) as z:
    assert set(z.namelist()) == {target + '.class' for target in classmap.values()}
    for name, c in inputs.items():
        actual = ClassFile(z.read(classmap[name] + '.class'))
        actual_classes[actual.name] = actual
        before, after = normalize_class(c, True), normalize_class(actual, False)
        if before != after:
            detail = output.parent / 'instruction-difference.json'
            assert not detail.exists()
            detail.write_text(json.dumps(dict(inputClass=name, expected=before, actual=after), indent=2, ensure_ascii=True) + '\n')
            raise AssertionError(('class instructions/attributes differ', name, str(detail)))
        counts['classesCompared'] += 1
assert literalhits == literalplan, (literalhits, literalplan)
assert counts['inputInstructions'] == counts['outputInstructions']
before_attrs = {(scope, name): n for (translate, scope, name), n in attributes_seen.items() if translate}
after_attrs = {(scope, name): n for (translate, scope, name), n in attributes_seen.items() if not translate}
assert before_attrs == after_attrs
original = load_jar(original_jar)
assert hashlib.sha256(original_jar.read_bytes()).hexdigest() == policy['originalJarSha256']
modifier_differences = []
original_fields = original_methods = native_declarations = 0
for name, original_class in original.items():
    assert name in actual_classes, ('missing original class', name)
    actual = actual_classes[name]
    assert (original_class.parent, original_class.interfaces, original_class.access) == (actual.parent, actual.interfaces, actual.access), ('class schema', name)
    for kind in ('fields', 'methods'):
        for member in getattr(original_class, kind):
            hits = [m for m in getattr(actual, kind) if (m['name'], m['desc']) == (member['name'], member['desc'])]
            assert len(hits) == 1, ('missing or duplicate original member', name, kind, member['name'], member['desc'])
            compiled = hits[0]
            if kind == 'fields': original_fields += 1
            else: original_methods += 1
            if member['access'] != compiled['access']:
                modifier_differences.append(dict(owner=name, kind=kind, name=member['name'], descriptor=member['desc'], original=member['access'], candidate=compiled['access']))
            if kind == 'methods' and member['access'] & 0x100:
                assert compiled['access'] == member['access']
                native_declarations += 1
sort_key = lambda d: (d['owner'], d['kind'], d['name'], d['descriptor'])
assert sorted(modifier_differences, key=sort_key) == sorted(policy['preexistingOriginalApiModifierDifferences'], key=sort_key), 'unexpected original-API modifier changes'
native_owners = {n for n,c in original.items() if any(m['access'] & 0x100 for m in c.methods)}
family = set(native_owners)
todo = list(family)
while todo:
    c = original[todo.pop()]
    for parent in [c.parent, *c.interfaces]:
        if parent in original and parent not in family:
            family.add(parent);todo.append(parent)
for callback in policy['nativeCallbacks']:
    key = (callback['name'], callback['descriptor'])
    a = [m for m in original[callback['owner']].methods if (m['name'],m['desc']) == key]
    b = [m for m in actual_classes[callback['owner']].methods if (m['name'],m['desc']) == key]
    assert len(a) == len(b) == 1 and a[0]['access'] == b[0]['access'], ('callback', callback)
actual_counts = dict(sourceClasses=len(inputs), sourceFiles=len({c['sourceFile'] for c in plan['classes']}), originalClasses=len(original), originalFields=original_fields, originalMethods=original_methods, originalSourceMethods=len(plan['methods']), sourceGeneratedMethods=len(plan['sourceGeneratedMethods']), nativeDeclarations=native_declarations, nativeOwners=len(native_owners), nativeFamilyClasses=len(family), nativeFamilyFields=sum(len(original[n].fields) for n in family), classNameLiteralSites=sum(literalhits.values()))
assert actual_counts == policy['expectedCounts'], ('original/source API scope differs', actual_counts, policy['expectedCounts'])
assert native_declarations == sum(bool(m['access'] & 0x100) for c in actual_classes.values() for m in c.methods)
report = dict(status='PASS', scope='Complete executable instructions, symbolic references, branches, handlers, frames, encountered attributes and original JVM API identities; only planned identifiers and compiler-proven class-name literals may change.', counts=dict(counts), apiCounts=actual_counts, nativeCallbacksMatched=len(policy['nativeCallbacks']), preexistingOriginalApiModifierDifferences=len(modifier_differences), introducedModifierDifferences=0, exactLiteralChanges=sum(literalhits.values()), attributesCompared={scope+':'+name:n for (scope,name),n in before_attrs.items()}, planSha256=hashlib.sha256(planfile.read_bytes()).hexdigest(), originalJarSha256=hashlib.sha256(original_jar.read_bytes()).hexdigest(), jarSha256=hashlib.sha256(restored_jar.read_bytes()).hexdigest(), verifierSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), nativeRuntimeVerified=False)
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
