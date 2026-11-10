import java.net.*;
import java.nio.channels.*;
public class BindNullCheck {
  public static void main(String[] args) throws Exception {
    try (ServerSocketChannel server = ServerSocketChannel.open(StandardProtocolFamily.UNIX)) {
      server.bind(null);
      SocketAddress address = server.getLocalAddress();
      System.out.println("address=" + address);
      try (SocketChannel client = SocketChannel.open(address)) {
        System.out.println("CONNECT_OK");
        server.accept().close();
      }
    }
    try (Selector selector = Selector.open()) { System.out.println("SELECTOR_OK=" + selector.isOpen()); }
  }
}
