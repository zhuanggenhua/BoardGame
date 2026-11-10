import java.net.*;
import java.nio.channels.*;
import java.nio.file.*;
public class SocketCheck {
  public static void main(String[] args) throws Exception {
    for (String raw : new String[]{"C:\\Windows\\Temp\\bg-loopback-check-2.sock", "D:\\gongzuo\\webgame\\BoardGame\\.playwright-mcp\\bg-loopback-check-2.sock"}) {
      Path path = Path.of(raw); Files.deleteIfExists(path);
      try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)) {
        server.bind(UnixDomainSocketAddress.of(path));
        System.out.println("UDS_BIND_OK " + path);
        try (SocketChannel client = SocketChannel.open(StandardProtocolFamily.UNIX)) {
          client.connect(UnixDomainSocketAddress.of(path));
          System.out.println("UDS_CONNECT_OK " + path);
        } catch (Throwable t) { System.out.println("UDS_CONNECT_FAIL " + path); t.printStackTrace(System.out); }
      } catch (Throwable t) { System.out.println("UDS_BIND_FAIL " + path); t.printStackTrace(System.out); }
      try { Files.deleteIfExists(path); } catch (Throwable t) { System.out.println("UDS_CLEANUP_FAIL " + path + " " + t); }
    }
    try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
         Socket client = new Socket("127.0.0.1", server.getLocalPort())) {
      System.out.println("TCP_LOOPBACK_OK");
    } catch (Throwable t) { System.out.println("TCP_LOOPBACK_FAIL"); t.printStackTrace(System.out); }
  }
}
