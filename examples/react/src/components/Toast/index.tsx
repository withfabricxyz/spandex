// import { Link } from "@tanstack/react-router";
// import { type ExternalToast, toast as sonnerToast, Toaster, type ToastT } from "sonner";
// import { IconArrow } from "~/components/library/Icons/IconArrow";
// import { IconClose } from "~/components/library/Icons/IconClose";
// import { Body, BodyCopy } from "~/components/library/Typography";
// import { IconButton } from "../IconButton";
// import { Icon } from "../Icons/Icon";
// import { IconArrowOutward } from "../Icons/IconArrowOutward";

// import "./Toast.css";
// import { useMediaQuery } from "~/hooks/useMediaQuery";

// interface ToastProps extends ToastT {
//   message: string;
//   link?: {
//     href: string;
//     label: string;
//     openInNewTab?: boolean;
//   };
// }

// function Toast(props: ToastProps) {
//   const { id, message, link, icon } = props;

//   return (
//     <div className="toast">
//       <div className="toast__content">
//         {icon}
//         <div className="toast__message">
//           <BodyCopy>{message}</BodyCopy>
//           {link && (
//             <Link
//               to={link.href}
//               target={link.openInNewTab ? "_blank" : undefined}
//               className="toast__link"
//             >
//               <Body>{link.label}</Body>
//               <Icon>{link.openInNewTab ? <IconArrowOutward /> : <IconArrow />}</Icon>
//             </Link>
//           )}
//         </div>
//         <IconButton
//           variant="inverse"
//           size="sm"
//           icon={<IconClose />}
//           onClick={() => sonnerToast.dismiss(id)}
//         />
//       </div>
//     </div>
//   );
// }

// export function toast(
//   message: string,
//   options?: Omit<ToastProps, "id" | "message"> & ExternalToast,
// ) {
//   const { link, icon, ...sonnerOptions } = options || {};

//   return sonnerToast.custom(
//     (id) => <Toast id={id} message={message} link={link} icon={icon} />,
//     sonnerOptions,
//   );
// }

// export function ToastPortal() {
//   const isDesktop = useMediaQuery("(min-width: 1024px)");

//   return <Toaster position={isDesktop ? "bottom-right" : "bottom-center"} />;
// }
