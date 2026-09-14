# Report-O-Matic — access permissions

**Maintainer rule:** Do **not** change who may do what by role without explicit approval in chat first.

## Add students (all roles)

These roles may **always** add pupils wherever the product offers add:

| Role | May add students |
|------|------------------|
| `owner` | Yes |
| `department_head` | Yes |
| `teacher` | Yes |

Apply on **every** add path:

| Surface | API |
|---------|-----|
| Class → Students → Add pupil | `POST /api/tenants/[tenantId]/students` |
| Dashboard → Active Students | `POST /api/tenants/[tenantId]/school-students` |
| Locate active pupil into a class | `POST /api/tenants/[tenantId]/school-students/[id]/enrollments` |

Code helpers (keep add open to all three roles):

- `canAddStudentsToClass` — `app/src/lib/auth/classAccess.ts`
- `canUseSchoolRoster` — `app/src/lib/auth/schoolRoster.ts` (view/add roster)

## Related (may differ)

| Action | Typical roles | Helper |
|--------|---------------|--------|
| View assigned class / reports (teachers) | Assigned teacher; owner/DH all classes | `canAccessClass` |
| Remove / archive active list | Owner, department head | `canManageSchoolRoster` |
| Move pupil between classes | Owner, department head | students PATCH |
| Timetable edit | Owner, department head | slot routes |
| Billing / buy credits | Owner | checkout route |

If unsure whether a change is a “permission redesign,” **ask first**.
