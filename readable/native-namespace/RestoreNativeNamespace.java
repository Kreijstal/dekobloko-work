import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.zip.*;
import org.objectweb.asm.*;
import org.objectweb.asm.commons.*;
import org.objectweb.asm.tree.*;
import org.objectweb.asm.tree.analysis.*;

/** Restore original JVM identities in a separate artifact. Never loads application classes. */
public final class RestoreNativeNamespace {
  static final class Key {
    final String owner, name, descriptor;
    Key(String o, String n, String d) {owner=o;name=n;descriptor=d;}
    @Override public boolean equals(Object other) {if(!(other instanceof Key))return false;Key k=(Key)other;return owner.equals(k.owner)&&name.equals(k.name)&&descriptor.equals(k.descriptor);}
    @Override public int hashCode() {return Objects.hash(owner,name,descriptor);}
  }
  static final class Site {
    final String file, value; final int line;
    Site(String f,int l,String v) {file=f;line=l;value=v;}
    @Override public boolean equals(Object other) {if(!(other instanceof Site))return false;Site s=(Site)other;return file.equals(s.file)&&line==s.line&&value.equals(s.value);}
    @Override public int hashCode() {return Objects.hash(file,line,value);}
    @Override public String toString() {return file+":"+line+":"+value;}
  }
  static final class Literal { final String target; int expected, actual; Literal(String t) {target=t;} }
  static final class Names extends Remapper {
    final Map<String,String> names=new LinkedHashMap<>(), sourceFiles=new HashMap<>();
    final Map<Key,String> methods=new HashMap<>(), fields=new HashMap<>();
    final Map<String,ClassNode> nodes=new LinkedHashMap<>();
    final Map<Site,Literal> literals=new LinkedHashMap<>();
    Names(Path plan) throws Exception {
      super(Opcodes.ASM9);
      for(String line:Files.readAllLines(plan,StandardCharsets.UTF_8)) {
        String[] a=line.split("\t",-1);
        switch(a[0]) {
          case "V": require(a.length==2&&a[1].equals("1"),"plan schema");break;
          case "C": {require(a.length==4,"class row");require(names.put(a[1],a[2])==null,"duplicate class");sourceFiles.put(a[1],a[3]);break;}
          case "M": case "X": case "F": {require(a.length==5,"member row");Map<Key,String> dest=a[0].equals("F")?fields:methods;require(dest.put(new Key(a[1],a[2],a[3]),a[4])==null,"duplicate member");break;}
          case "S": {require(a.length==5,"literal row");Site key=new Site(a[1],Integer.parseInt(a[2]),a[3]);Literal l=literals.computeIfAbsent(key,k->new Literal(a[4]));require(l.target.equals(a[4]),"inconsistent literal mapping");l.expected++;break;}
          default: throw new IllegalStateException("unknown plan row: "+a[0]);
        }
      }
      require(new HashSet<>(names.values()).size()==names.size(),"class target collision");
    }
    @Override public String map(String name) {return names.getOrDefault(name,name);}
    String find(String owner,String name,String descriptor,boolean field,Set<String> seen) {
      if(!seen.add(owner))return null;
      ClassNode n=nodes.get(owner);if(n==null)return null;
      boolean declared=field?n.fields.stream().anyMatch(f->f.name.equals(name)&&f.desc.equals(descriptor)):n.methods.stream().anyMatch(m->m.name.equals(name)&&m.desc.equals(descriptor));
      if(declared)return (field?fields:methods).getOrDefault(new Key(owner,name,descriptor),name);
      if(!field&&n.superName!=null) {String found=find(n.superName,name,descriptor,false,seen);if(found!=null)return found;}
      Set<String> choices=new TreeSet<>();for(String i:n.interfaces){String found=find(i,name,descriptor,field,new HashSet<>(seen));if(found!=null)choices.add(found);}
      require(choices.size()<=1,"ambiguous inherited member: "+owner+"."+name+descriptor);
      if(!choices.isEmpty())return choices.iterator().next();
      if(field&&n.superName!=null)return find(n.superName,name,descriptor,true,seen);
      return null;
    }
    @Override public String mapMethodName(String owner,String name,String descriptor) {
      if(name.equals("<init>")||name.equals("<clinit>"))return name;
      String found=find(owner,name,descriptor,false,new HashSet<>());return found==null?name:found;
    }
    @Override public String mapFieldName(String owner,String name,String descriptor) {
      String found=find(owner,name,descriptor,true,new HashSet<>());return found==null?name:found;
    }
  }
  static void require(boolean ok,String message) {if(!ok)throw new IllegalStateException(message);}
  static String json(Object value) {
    if(value==null)return "null";
    if(value instanceof Number||value instanceof Boolean)return value.toString();
    if(value instanceof Map<?,?>){Map<?,?> m=(Map<?,?>)value;List<String> out=new ArrayList<>();for(var e:m.entrySet())out.add(json(e.getKey().toString())+":"+json(e.getValue()));return "{"+String.join(",",out)+"}";}
    if(value instanceof Collection<?>){Collection<?> c=(Collection<?>)value;List<String> out=new ArrayList<>();for(Object e:c)out.add(json(e));return "["+String.join(",",out)+"]";}
    String s=value.toString();StringBuilder b=new StringBuilder("\"");for(int i=0;i<s.length();i++){char c=s.charAt(i);if(c=='"'||c=='\\')b.append('\\').append(c);else if(c<' ')b.append(String.format(Locale.ROOT,"\\u%04x",(int)c));else b.append(c);}return b.append('"').toString();
  }
  static List<Map<String,Object>> patchLiterals(Names names) throws Exception {
    List<Map<String,Object>> changes=new ArrayList<>();Set<AbstractInsnNode> patched=Collections.newSetFromMap(new IdentityHashMap<>());
    for(ClassNode c:names.nodes.values()) {
      String source=names.sourceFiles.get(c.name);require(source!=null,"unmapped source class");require(c.sourceFile!=null&&Path.of(source).getFileName().toString().equals(c.sourceFile),"source-file identity");
      for(MethodNode m:c.methods) {
        if((m.access&(Opcodes.ACC_NATIVE|Opcodes.ACC_ABSTRACT))!=0)continue;
        Map<AbstractInsnNode,Integer> lines=new IdentityHashMap<>();int line=-1;for(AbstractInsnNode i:m.instructions){if(i instanceof LineNumberNode)line=((LineNumberNode)i).line;lines.put(i,line);}
        Frame<SourceValue>[] frames=new Analyzer<>(new SourceInterpreter()).analyze(c.name,m);
        int index=0;for(AbstractInsnNode i:m.instructions) {
          if(i instanceof MethodInsnNode&&((MethodInsnNode)i).owner.equals("java/lang/Class")&&((MethodInsnNode)i).name.equals("forName")) {MethodInsnNode call=(MethodInsnNode)i;
            Type[] args=Type.getArgumentTypes(call.desc);require(args.length>=1&&args[0].equals(Type.getType(String.class)),"Class.forName signature");Frame<SourceValue> frame=frames[index];
            if(frame!=null){SourceValue value=frame.getStack(frame.getStackSize()-args.length);if(value.insns.size()==1&&value.insns.iterator().next() instanceof LdcInsnNode&&((LdcInsnNode)value.insns.iterator().next()).cst instanceof String){LdcInsnNode ldc=(LdcInsnNode)value.insns.iterator().next();String string=(String)ldc.cst;
              Site site=new Site(source,lines.get(ldc),string);Literal spec=names.literals.get(site);
              if(spec!=null){require(patched.add(ldc),"shared literal instruction needs separate provenance");spec.actual++;Map<String,Object> r=new LinkedHashMap<>();r.put("owner",c.name);r.put("method",m.name);r.put("descriptor",m.desc);r.put("sourceFile",source);r.put("line",site.line);r.put("before",string);r.put("after",spec.target);changes.add(r);ldc.cst=spec.target;}
            }}
          }
          index++;
        }
      }
    }
    for(var e:names.literals.entrySet())require(e.getValue().actual==e.getValue().expected,"class literal provenance/count mismatch: "+e.getKey()+" expected "+e.getValue().expected+" actual "+e.getValue().actual);
    return changes;
  }
  public static void main(String[] args) throws Exception {
    require(args.length==4,"plan.tsv input-classes output.jar report.json");Path plan=Path.of(args[0]),input=Path.of(args[1]),output=Path.of(args[2]),report=Path.of(args[3]);require(!Files.exists(output)&&!Files.exists(report),"refuse overwriting namespace artifacts");Names names=new Names(plan);
    List<Path> files;try(var stream=Files.walk(input)){files=stream.filter(p->p.toString().endsWith(".class")).sorted().collect(java.util.stream.Collectors.toList());}
    for(Path file:files){ClassNode node=new ClassNode();new ClassReader(Files.readAllBytes(file)).accept(node,0);require(names.names.containsKey(node.name),"class not in plan: "+node.name);require(names.nodes.put(node.name,node)==null,"duplicate class");}
    require(names.nodes.size()==names.names.size(),"input class coverage");
    for(var key:names.fields.keySet()){ClassNode c=names.nodes.get(key.owner);require(c!=null&&c.fields.stream().anyMatch(f->f.name.equals(key.name)&&f.desc.equals(key.descriptor)),"planned field absent: "+key);}
    for(var key:names.methods.keySet()){ClassNode c=names.nodes.get(key.owner);require(c!=null&&c.methods.stream().anyMatch(m->m.name.equals(key.name)&&m.desc.equals(key.descriptor)),"planned method absent: "+key);}
    List<Map<String,Object>> literals=patchLiterals(names);Map<String,byte[]> rewritten=new TreeMap<>();int nativeDeclarations=0;
    for(ClassNode node:names.nodes.values()){nativeDeclarations+=(int)node.methods.stream().filter(m->(m.access&Opcodes.ACC_NATIVE)!=0).count();ClassWriter writer=new ClassWriter(0);node.accept(new ClassRemapper(writer,names));byte[] bytes=writer.toByteArray();String target=new ClassReader(bytes).getClassName();require(target.equals(names.map(node.name)),"class name remapping");require(rewritten.put(target+".class",bytes)==null,"output class collision");}
    try(ZipOutputStream zip=new ZipOutputStream(Files.newOutputStream(output,StandardOpenOption.CREATE_NEW))){for(var e:rewritten.entrySet()){byte[] b=e.getValue();ZipEntry entry=new ZipEntry(e.getKey());entry.setTimeLocal(LocalDateTime.of(1980,1,2,0,0));entry.setMethod(ZipEntry.STORED);entry.setSize(b.length);entry.setCompressedSize(b.length);CRC32 crc=new CRC32();crc.update(b);entry.setCrc(crc.getValue());zip.putNextEntry(entry);zip.write(b);zip.closeEntry();}}
    Map<String,Object> result=new LinkedHashMap<>();result.put("status","GENERATED;independent API and instruction verification still required");result.put("classes",rewritten.size());result.put("nativeDeclarations",nativeDeclarations);result.put("plannedFields",names.fields.size());result.put("plannedMethods",names.methods.size());result.put("classNameLiteralChanges",literals);result.put("applicationClassesLoaded",false);result.put("applicationNativeCodeExecuted",false);result.put("repositoryMetadataApplied",false);result.put("nativeAbiMigrationVerified",false);result.put("nativeRuntimeVerified",false);Files.writeString(report,json(result)+"\n",StandardCharsets.UTF_8,StandardOpenOption.CREATE_NEW);System.out.println(json(result));
  }
}
