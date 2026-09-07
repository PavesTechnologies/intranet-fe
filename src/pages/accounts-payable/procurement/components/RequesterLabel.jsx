/**
 * Displays who raised a PR. There is no user/employee directory endpoint wired into the AP
 * module (only the requester's opaque id is on the PR record), so this shows "You" for the
 * signed-in user's own requisitions and a shortened, hoverable id otherwise — never a fabricated
 * name.
 * @param {{ createdBy?: string, isRequester: boolean, className?: string }} props
 */
export default function RequesterLabel({ createdBy, isRequester, className = "" }) {
  if (!createdBy) {
    return <span className={`text-sm text-gray-400 ${className}`}>—</span>;
  }

  if (isRequester) {
    return (
      <span className={`text-sm font-medium text-gray-900 ${className}`} title={createdBy}>
        You
      </span>
    );
  }

  return (
    <span className={`font-mono text-xs text-gray-500 ${className}`} title={createdBy}>
      {String(createdBy).slice(0, 8)}
    </span>
  );
}
