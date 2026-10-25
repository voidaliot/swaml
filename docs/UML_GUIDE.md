# Guide for UML architects

swa.ml 2.0.

A swa.ml component is a software ownership/communication boundary, with private attributes, child occurrences and operations. A component def is reusable; a usage is an occurrence. swa.ml 2.0 intentionally has no separate class/function categories, performers or action allocation. Single specialization and explicit compatible whole-member redefinition are supported; generic UML object/reference semantics are not implicit.

Ports expose directed attribute/event/operation members and use name-based structural compatibility. Provides/requires belongs to each member. Reversed flips a whole port. Explicit connect derives peer connection or boundary forwarding; forwarding adds no queue. A service diagram cannot replace member direction or prove a route.

Operations own flow or states. A schedule supplies activation and deadlines. Nested operations have no closure captures; calls are typed expressions. State transitions live inside their source state and declaration order selects the first enabled reaction. There are no priorities, completion transitions or orthogonal/hierarchical states.

Use cases and verification cases are rooted routed intent. A subject names the system under consideration and actors name the participating occurrences outside it; include and extend relate use cases of the same root. Requirements and satisfy/verify do not prove fulfillment. Views project existing source identities and cannot introduce unsupported UML/SysML concepts. See [usage](USER_GUIDE.md), [mapping boundaries](UML_COMPATIBILITY.md) and [canonical notation](GRAPHICAL_NOTATION.md).
